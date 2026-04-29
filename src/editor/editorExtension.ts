import {
	EditorView,
	ViewPlugin,
	ViewUpdate,
	Decoration,
	DecorationSet,
	WidgetType,
	MatchDecorator,
	PluginValue,
} from '@codemirror/view';
import { RangeSet } from '@codemirror/state';
import { hasGoodContrast } from '../utils/colorParser';
import type { ColorPreviewSettings } from '../types';

// Combined color regex
// MatchDecorator needs its own RegExp
// instance (it mutates lastIndex internally).
const HEX_SRC = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})(?![0-9a-fA-F])/;
const RGB_SRC = /rgba?\(\s*(?:25[0-5]|2[0-4]\d|1?\d{1,2})\s*,\s*(?:25[0-5]|2[0-4]\d|1?\d{1,2})\s*,\s*(?:25[0-5]|2[0-4]\d|1?\d{1,2})(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)/;
const HSL_SRC = /hsla?\(\s*(?:36[0]|3[0-5]\d|[12]?\d{1,2})\s*,\s*(?:100|\d{1,2})%\s*,\s*(?:100|\d{1,2})%(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)/;
const COMBINED_SRC = [HEX_SRC, RGB_SRC, HSL_SRC].map(r => r.source).join('|');


// Swatch widget
class ColorSwatchWidget extends WidgetType {
	constructor(readonly color: string) { super(); }

	toDOM(): HTMLElement {
		const el = document.createElement('span');
		el.className = 'cp-color-swatch';
		el.style.backgroundColor = this.color;
		el.setAttribute('aria-label', `Color: ${this.color}`);
		return el;
	}

	eq(other: ColorSwatchWidget): boolean { return this.color === other.color; }
	ignoreEvent(): boolean { return true; }
}


// MatchDecorator factories
function makeSwatchDecorator(): MatchDecorator {
	return new MatchDecorator({
		regexp: new RegExp(COMBINED_SRC, 'gi'),
		decoration: (match) =>
			Decoration.widget({
				widget: new ColorSwatchWidget(match[0]),
				side: -1, // insert before the matched text
			}),
	});
}

function makeMarkDecorator(): MatchDecorator {
	return new MatchDecorator({
		regexp: new RegExp(COMBINED_SRC, 'gi'),
		// Return null (cast) to skip colors with poor contrast
		decoration: (match) => {
			const color = match[0];
			if (!hasGoodContrast(color)) return null as unknown as Decoration;
			return Decoration.mark({
				class: 'cp-colored-text',
				attributes: { style: `color: ${color} !important;`, 'data-color': color },
			});
		},
	});
}


// ViewPlugin
class ColorPreviewPlugin implements PluginValue {
	decorations: DecorationSet;

	private swatchDeco: MatchDecorator | null = null;
	private markDeco: MatchDecorator | null = null;
	private swatchSet: DecorationSet = Decoration.none;
	private markSet: DecorationSet = Decoration.none;
	private lastSettingsKey = '';

	constructor(
		private readonly view: EditorView,
		private readonly getSettings: () => ColorPreviewSettings,
	) {
		this.initialize(view);
		this.decorations = this.merged();
	}

	update(update: ViewUpdate): void {
		const s = this.getSettings();
		const key = `${s.showSwatchInEditor}|${s.colorizeTextInEditor}`;
		const settingsChanged = key !== this.lastSettingsKey;

		if (settingsChanged) {
			// Settings changed — recreate decorators and rebuild from scratch.
			this.initialize(update.view);
		} else if (update.docChanged || update.viewportChanged) {
			// Incremental update — MatchDecorator.updateDeco() only rescans
			// changed/newly visible ranges, reusing everything else.
			if (this.swatchDeco) {
				this.swatchSet = this.swatchDeco.updateDeco(update, this.swatchSet);
			}
			if (this.markDeco) {
				this.markSet = this.markDeco.updateDeco(update, this.markSet);
			}
		} else {
			return; // nothing to do
		}

		this.decorations = this.merged();
	}

	private initialize(view: EditorView): void {
		const s = this.getSettings();
		this.lastSettingsKey = `${s.showSwatchInEditor}|${s.colorizeTextInEditor}`;

		this.swatchDeco = s.showSwatchInEditor ? makeSwatchDecorator() : null;
		this.markDeco = s.colorizeTextInEditor ? makeMarkDecorator() : null;

		this.swatchSet = this.swatchDeco
			? this.swatchDeco.createDeco(view)
			: Decoration.none;
		this.markSet = this.markDeco
			? this.markDeco.createDeco(view)
			: Decoration.none;
	}

	// Merge the two DecorationSets into one.
	private merged(): DecorationSet {
		if (this.swatchSet === Decoration.none) return this.markSet;
		if (this.markSet === Decoration.none) return this.swatchSet;
		return RangeSet.join([this.swatchSet, this.markSet]) as DecorationSet;
	}

	destroy(): void { /* nothing to clean up */ }
}


// Public factory
export function createColorPreviewExtension(getSettings: () => ColorPreviewSettings) {
	return ViewPlugin.fromClass(
		class extends ColorPreviewPlugin {
			constructor(view: EditorView) { super(view, getSettings); }
		},
		{ decorations: (plugin) => plugin.decorations }
	);
}