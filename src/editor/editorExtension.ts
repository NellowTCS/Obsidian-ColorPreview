import {
	EditorView,
	ViewPlugin,
	ViewUpdate,
	Decoration,
	DecorationSet,
	WidgetType,
} from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';
import { findColorsInText, hasGoodContrast, ColorMatch } from '../utils/colorParser';
import type { ColorPreviewSettings } from '../types';

// Swatch widget
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

// Decoration builder
// collect all (from, to, decoration) triples, sort them once, then feed them to the builder
function buildDecorations(
	matches: ColorMatch[],
	settings: ColorPreviewSettings
): DecorationSet {
	type Entry = { from: number; to: number; decoration: Decoration };
	const entries: Entry[] = [];

	for (const match of matches) {
		if (settings.showSwatchInEditor) {
			// Point decoration: from === to === match.from
			entries.push({
				from: match.from,
				to: match.from,
				decoration: Decoration.widget({
					widget: new ColorSwatchWidget(match.color),
					side: -1, // render before the character at `from`
				}),
			});
		}

		if (settings.colorizeTextInEditor && hasGoodContrast(match.color)) {
			entries.push({
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

	// Sort: primary key = from ascending; secondary = to ascending so that
	// the zero-length point decoration (to === from) comes before the mark
	// (to > from) when they share the same from.
	entries.sort((a, b) => a.from - b.from || a.to - b.to);

	const builder = new RangeSetBuilder<Decoration>();
	for (const { from, to, decoration } of entries) {
		builder.add(from, to, decoration);
	}
	return builder.finish();
}

// ViewPlugin
function collectVisibleMatches(view: EditorView): ColorMatch[] {
	const matches: ColorMatch[] = [];
	for (const { from, to } of view.visibleRanges) {
		const text = view.state.doc.sliceString(from, to);
		matches.push(...findColorsInText(text, from));
	}
	return matches;
}

function settingsKey(s: ColorPreviewSettings): string {
	return `${s.showSwatchInEditor}|${s.colorizeTextInEditor}`;
}

class ColorPreviewViewPlugin {
	decorations: DecorationSet;
	private lastSettingsKey: string;

	constructor(
		private readonly view: EditorView,
		private readonly getSettings: () => ColorPreviewSettings
	) {
		this.lastSettingsKey = settingsKey(this.getSettings());
		this.decorations = this.rebuild();
	}

	update(update: ViewUpdate): void {
		const currentKey = settingsKey(this.getSettings());
		const settingsChanged = currentKey !== this.lastSettingsKey;

		if (update.docChanged || update.viewportChanged || settingsChanged || update.geometryChanged) {
			this.lastSettingsKey = currentKey;
			this.decorations = this.rebuild();
		}
	}

	private rebuild(): DecorationSet {
		try {
			const matches = collectVisibleMatches(this.view);
			return buildDecorations(matches, this.getSettings());
		} catch (err) {
			console.error('ColorPreview: Failed to build decorations', err);
			return Decoration.none;
		}
	}
}

// Public factory
export function createColorPreviewExtension(getSettings: () => ColorPreviewSettings) {
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