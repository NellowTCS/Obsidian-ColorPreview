import { EditorView, ViewPlugin, ViewUpdate, Decoration, DecorationSet, WidgetType } from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';
import { findColorsInText, hasGoodContrast, ColorMatch } from '../utils/colorParser';
import type { ColorPreviewSettings } from '../types';

/**
 * Widget for displaying color swatch in the editor
 */
class ColorSwatchWidget extends WidgetType {
	constructor(private readonly color: string) {
		super();
	}

	toDOM(): HTMLElement {
		const swatch = document.createElement('span');
		swatch.className = 'cp-color-swatch';
		swatch.style.backgroundColor = this.color;
		swatch.setAttribute('data-color', this.color);
		swatch.setAttribute('aria-label', `Color preview: ${this.color}`);
		return swatch;
	}

	eq(other: ColorSwatchWidget): boolean {
		return this.color === other.color;
	}

	ignoreEvent(): boolean {
		return true;
	}
}

/**
 * Find color matches in the current visible range
 */
function findVisibleColors(view: EditorView): ColorMatch[] {
	const matches: ColorMatch[] = [];

	for (const { from, to } of view.visibleRanges) {
		const text = view.state.doc.sliceString(from, to);
		const rangeMatches = findColorsInText(text, from);
		matches.push(...rangeMatches);
	}

	return matches;
}

/**
 * Build decoration set from color matches
 */
function buildDecorations(
	matches: ColorMatch[],
	settings: ColorPreviewSettings
): DecorationSet {
	const builder = new RangeSetBuilder<Decoration>();

	// Separate decorations by type for proper ordering
	const swatchDecorations: Array<{ pos: number; decoration: Decoration }> = [];
	const markDecorations: Array<{ from: number; to: number; decoration: Decoration }> = [];

	for (const match of matches) {
		// Add swatch widget (point decoration)
		if (settings.showSwatchInEditor) {
			swatchDecorations.push({
				pos: match.from,
				decoration: Decoration.widget({
					widget: new ColorSwatchWidget(match.color),
					side: -1,
				}),
			});
		}

		// Add text coloring (range decoration)
		if (settings.colorizeTextInEditor && hasGoodContrast(match.color)) {
			markDecorations.push({
				from: match.from,
				to: match.to,
				decoration: Decoration.mark({
					class: 'cp-colored-text',
					attributes: {
						style: `color: ${match.color} !important;`,
						'data-color': match.color,
					},
				}),
			});
		}
	}

	// Add point decorations first
	swatchDecorations.sort((a, b) => a.pos - b.pos);
	for (const { pos, decoration } of swatchDecorations) {
		builder.add(pos, pos, decoration);
	}

	// Then add range decorations
	markDecorations.sort((a, b) => a.from - b.from);
	for (const { from, to, decoration } of markDecorations) {
		builder.add(from, to, decoration);
	}

	return builder.finish();
}

/**
 * Main ViewPlugin for color preview in the editor
 */
class ColorPreviewViewPlugin {
	decorations: DecorationSet;
	private settingsSnapshot: string;

	constructor(
		private readonly view: EditorView,
		private readonly getSettings: () => ColorPreviewSettings
	) {
		this.settingsSnapshot = this.captureSettings();
		this.decorations = this.rebuildDecorations();
	}

	update(update: ViewUpdate): void {
		const currentSettings = this.captureSettings();
		const settingsChanged = currentSettings !== this.settingsSnapshot;

		if (
			update.docChanged ||
			update.viewportChanged ||
			settingsChanged
		) {
			this.settingsSnapshot = currentSettings;
			this.decorations = this.rebuildDecorations();
		}
	}

	private captureSettings(): string {
		const settings = this.getSettings();
		return JSON.stringify({
			swatch: settings.showSwatchInEditor,
			colorize: settings.colorizeTextInEditor,
		});
	}

	private rebuildDecorations(): DecorationSet {
		try {
			const matches = findVisibleColors(this.view);
			return buildDecorations(matches, this.getSettings());
		} catch (error) {
			console.error('ColorPreview: Failed to build decorations', error);
			return Decoration.none;
		}
	}

	destroy(): void {
		// Cleanup if needed
	}
}

/**
 * Creates the CodeMirror extension for color preview
 */
export function createColorPreviewExtension(
	getSettings: () => ColorPreviewSettings
) {
	return ViewPlugin.fromClass(
		class extends ColorPreviewViewPlugin {
			constructor(view: EditorView) {
				super(view, getSettings);
			}
		},
		{
			decorations: (plugin) => plugin.decorations,
		}
	);
}