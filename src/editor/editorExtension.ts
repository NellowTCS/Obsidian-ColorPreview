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
import { hasGoodContrast } from '../utils/colorParser';
import type { ColorPreviewSettings } from '../types';

// Regex source
const HEX_SRC = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})(?![0-9a-fA-F])/;
const RGB_SRC = /rgba?\(\s*(?:25[0-5]|2[0-4]\d|1?\d{1,2})\s*,\s*(?:25[0-5]|2[0-4]\d|1?\d{1,2})\s*,\s*(?:25[0-5]|2[0-4]\d|1?\d{1,2})(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)/;
const HSL_SRC = /hsla?\(\s*(?:36[0]|3[0-5]\d|[12]?\d{1,2})\s*,\s*(?:100|\d{1,2})%\s*,\s*(?:100|\d{1,2})%(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)/;
const COMBINED_SRC = [HEX_SRC, RGB_SRC, HSL_SRC].map(r => r.source).join('|');

// ColorWidget
class ColorWidget extends WidgetType {
	constructor(
		readonly color: string,
		readonly originalText: string,
		readonly showSwatch: boolean,
		readonly colorizeText: boolean,
	) { super(); }

	eq(other: ColorWidget): boolean {
		return (
			this.color === other.color &&
			this.originalText === other.originalText &&
			this.showSwatch === other.showSwatch &&
			this.colorizeText === other.colorizeText
		);
	}

	toDOM(): HTMLElement {
		const wrapper = document.createElement('span');
		wrapper.className = 'cp-color-inline';
		// Let CM6 know this widget represents the replaced text, for a11y
		wrapper.setAttribute('aria-label', `Color: ${this.color}`);

		if (this.showSwatch) {
			const swatch = document.createElement('span');
			swatch.className = 'cp-color-swatch';
			swatch.style.backgroundColor = this.color;
			wrapper.appendChild(swatch);
		}

		const label = document.createElement('span');
		label.textContent = this.originalText;

		const canColorize = this.colorizeText && hasGoodContrast(this.color);
		if (canColorize) {
			label.className = 'cp-colored-text';
			label.style.color = this.color;
		}

		wrapper.appendChild(label);
		return wrapper;
	}

	ignoreEvent(): boolean { return false; }
}

// MatchDecorator factory
function makeDecorator(settings: ColorPreviewSettings): MatchDecorator {
	return new MatchDecorator({
		regexp: new RegExp(COMBINED_SRC, 'gi'),
		decoration: (match) => {
			const color = match[0];
			return Decoration.replace({
				widget: new ColorWidget(
					color,
					match[0],
					settings.showSwatchInEditor,
					settings.colorizeTextInEditor,
				),
			});
		},
	});
}

// ViewPlugin
class ColorPreviewPlugin implements PluginValue {
	decorations: DecorationSet;
	private decorator: MatchDecorator;
	private lastSettingsKey: string;

	constructor(
		private readonly view: EditorView,
		private readonly getSettings: () => ColorPreviewSettings,
	) {
		const s = this.getSettings();
		this.lastSettingsKey = this.settingsKey(s);
		this.decorator = makeDecorator(s);
		this.decorations = this.decorator.createDeco(view);
	}

	update(update: ViewUpdate): void {
		const s = this.getSettings();
		const key = this.settingsKey(s);

		if (key !== this.lastSettingsKey) {
			// Settings changed — new decorator needed (widget params changed)
			this.lastSettingsKey = key;
			this.decorator = makeDecorator(s);
			this.decorations = this.decorator.createDeco(update.view);
		} else if (update.docChanged || update.viewportChanged) {
			// Incremental update — reuse existing decorations where unchanged
			this.decorations = this.decorator.updateDeco(update, this.decorations);
		}
	}

	private settingsKey(s: ColorPreviewSettings): string {
		return `${s.showSwatchInEditor}|${s.colorizeTextInEditor}`;
	}

	destroy(): void { /* nothing to clean up */ }
}

// Public factory
export function createColorPreviewExtension(getSettings: () => ColorPreviewSettings) {
	return ViewPlugin.fromClass(
		class implements PluginValue {
			decorations: DecorationSet;
			private inner: ColorPreviewPlugin;

			constructor(view: EditorView) {
				this.inner = new ColorPreviewPlugin(view, getSettings);
				this.decorations = this.inner.decorations;
			}

			update(update: ViewUpdate) {
				this.inner.update(update);
				this.decorations = this.inner.decorations;
			}

			destroy() { this.inner.destroy(); }
		},
		{ decorations: v => v.decorations }
	);
}