import {
	App,
	MarkdownPostProcessorContext,
	Plugin,
	PluginSettingTab,
	Setting,
} from "obsidian";
import {
	Decoration,
	DecorationSet,
	EditorView,
	ViewPlugin,
	ViewUpdate,
	WidgetType,
} from "@codemirror/view";
import { Extension, RangeSetBuilder } from "@codemirror/state";

/** Settings */
interface ColorPreviewSettings {
	showSwatchInEditor: boolean;
	colorizeTextInEditor: boolean;
	enableInReadingView: boolean;
}

const DEFAULT_SETTINGS: ColorPreviewSettings = {
	showSwatchInEditor: true,
	colorizeTextInEditor: false,
	enableInReadingView: true,
};

/** Enhanced regex for supported colors */
const COLOR_REGEX =
	/(?:#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b|(?:rgba?|hsla?)\(\s*[^)]+\))/g;

/** Validate if color is renderable */
function isValidColor(colorStr: string): boolean {
	const testElement = document.createElement("div");
	testElement.style.color = "";
	testElement.style.color = colorStr;
	return testElement.style.color !== "";
}

/** Check if color is too light (will be invisible on light backgrounds) */
function isColorTooLight(colorStr: string): boolean {
	const testElement = document.createElement("div");
	testElement.style.color = colorStr;
	document.body.appendChild(testElement);

	const computedColor = getComputedStyle(testElement).color;
	document.body.removeChild(testElement);

	// Parse RGB values
	const rgbMatch = computedColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
	if (!rgbMatch) return false;

	const [, r, g, b] = rgbMatch.map(Number);

	// Calculate luminance (perceived brightness)
	const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

	// Consider colors with luminance > 0.8 as too light
	return luminance > 0.8;
}

/** Check if color is too dark (will be invisible on dark backgrounds) */
function isColorTooDark(colorStr: string): boolean {
	const testElement = document.createElement("div");
	testElement.style.color = colorStr;
	document.body.appendChild(testElement);

	const computedColor = getComputedStyle(testElement).color;
	document.body.removeChild(testElement);

	// Parse RGB values
	const rgbMatch = computedColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
	if (!rgbMatch) return false;

	const [, r, g, b] = rgbMatch.map(Number);

	// Calculate luminance
	const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

	// Consider colors with luminance < 0.2 as too dark
	return luminance < 0.2;
}

/** Color match interface */
interface ColorMatch {
	from: number;
	to: number;
	color: string;
}

/** Swatch widget */
class ColorSwatchWidget extends WidgetType {
	constructor(private color: string) {
		super();
	}

	toDOM(): HTMLElement {
		const swatch = document.createElement("span");
		swatch.className = "cp-color-swatch";
		swatch.style.backgroundColor = this.color;
		swatch.setAttribute("data-color", this.color);
		return swatch;
	}

	ignoreEvent(): boolean {
		return true;
	}

	eq(other: ColorSwatchWidget): boolean {
		return this.color === other.color;
	}
}

/** Find all color matches in visible ranges */
function findColorMatches(view: EditorView): ColorMatch[] {
	const matches: ColorMatch[] = [];

	for (const range of view.visibleRanges) {
		const text = view.state.doc.sliceString(range.from, range.to);
		let match: RegExpExecArray | null;

		COLOR_REGEX.lastIndex = 0;
		while ((match = COLOR_REGEX.exec(text)) !== null) {
			const colorStr = match[0];

			if (isValidColor(colorStr)) {
				matches.push({
					from: range.from + match.index,
					to: range.from + match.index + colorStr.length,
					color: colorStr,
				});
			}
		}
	}

	return matches.sort((a, b) => a.from - b.from);
}

/** Create decorations from color matches */
function createDecorations(
	matches: ColorMatch[],
	settings: ColorPreviewSettings
): DecorationSet {
	const builder = new RangeSetBuilder<Decoration>();

	// Create all decorations and sort them properly
	const decorations: {
		pos: number;
		decoration: Decoration;
		isPoint: boolean;
	}[] = [];

	for (const match of matches) {
		// Add swatch widget (point decoration)
		if (settings.showSwatchInEditor) {
			decorations.push({
				pos: match.from,
				decoration: Decoration.widget({
					widget: new ColorSwatchWidget(match.color),
					side: -1, // Place before the text
				}),
				isPoint: true,
			});
		}

		// Add text coloring (range decoration)
		if (settings.colorizeTextInEditor) {
			// Only colorize if the color won't be invisible
			const shouldColorize =
				!isColorTooLight(match.color) && !isColorTooDark(match.color);
			if (shouldColorize) {
				decorations.push({
					pos: match.from,
					decoration: Decoration.mark({
						class: "cp-colored-text",
						attributes: {
							style: `color: ${match.color} !important;`,
							"data-color": match.color,
						},
					}),
					isPoint: false,
				});
			}
		}
	}

	// Sort decorations: point decorations first (by position), then range decorations
	decorations.sort((a, b) => {
		if (a.pos !== b.pos) return a.pos - b.pos;
		if (a.isPoint !== b.isPoint) return a.isPoint ? -1 : 1;
		return 0;
	});

	// Add decorations to builder
	for (const { pos, decoration, isPoint } of decorations) {
		if (isPoint) {
			builder.add(pos, pos, decoration);
		} else {
			// Find the matching range for this position
			const match = matches.find((m) => m.from === pos);
			if (match) {
				builder.add(match.from, match.to, decoration);
			}
		}
	}

	return builder.finish();
}

/** ViewPlugin class */
class ColorPreviewViewPlugin {
	decorations: DecorationSet;
	private lastSettingsHash: string;

	constructor(
		private view: EditorView,
		private getSettings: () => ColorPreviewSettings
	) {
		this.lastSettingsHash = this.getSettingsHash();
		this.decorations = this.buildDecorations();
	}

	update(update: ViewUpdate) {
		const currentSettingsHash = this.getSettingsHash();
		const settingsChanged = currentSettingsHash !== this.lastSettingsHash;

		if (
			update.docChanged ||
			update.viewportChanged ||
			update.geometryChanged ||
			settingsChanged
		) {
			this.lastSettingsHash = currentSettingsHash;
			this.decorations = this.buildDecorations();
		}
	}

	private getSettingsHash(): string {
		const settings = this.getSettings();
		return JSON.stringify({
			swatch: settings.showSwatchInEditor,
			colorize: settings.colorizeTextInEditor,
		});
	}

	private buildDecorations(): DecorationSet {
		try {
			const matches = findColorMatches(this.view);
			return createDecorations(matches, this.getSettings());
		} catch (error) {
			console.error("ColorPreview: Error building decorations:", error);
			return Decoration.none;
		}
	}
}

/** Create the ViewPlugin */
function createColorPreviewPlugin(settings: ColorPreviewSettings) {
	// Create a function that returns current settings to allow dynamic updates
	const getSettings = () => settings;

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

/** Process reading view */
function processReadingView(
	element: HTMLElement,
	settings: ColorPreviewSettings
): void {
	// First, clean up any existing color previews to prevent duplicates
	element
		.querySelectorAll(".cp-color-wrapper, .cp-color-swatch")
		.forEach((el) => {
			const parent = el.parentNode;
			if (parent && el.textContent) {
				parent.replaceChild(
					document.createTextNode(el.textContent.replace(/^\s*/, "")),
					el
				);
			}
		});

	// Normalize text nodes after cleanup
	element.normalize();

	const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
		acceptNode: (node) => {
			// Skip if inside code blocks
			if (node.parentElement?.closest("code, pre")) {
				return NodeFilter.FILTER_REJECT;
			}
			// Skip if already processed
			if (node.parentElement?.classList.contains("cp-color-wrapper")) {
				return NodeFilter.FILTER_REJECT;
			}
			// Only accept nodes that might contain colors
			return node.nodeValue && COLOR_REGEX.test(node.nodeValue)
				? NodeFilter.FILTER_ACCEPT
				: NodeFilter.FILTER_REJECT;
		},
	});

	const textNodes: Text[] = [];
	let node: Node | null;
	while ((node = walker.nextNode())) {
		textNodes.push(node as Text);
	}

	for (const textNode of textNodes) {
		const text = textNode.nodeValue || "";
		const fragment = document.createDocumentFragment();

		let lastIndex = 0;
		let match: RegExpExecArray | null;

		COLOR_REGEX.lastIndex = 0;
		while ((match = COLOR_REGEX.exec(text)) !== null) {
			// Add text before match
			if (match.index > lastIndex) {
				fragment.appendChild(
					document.createTextNode(text.slice(lastIndex, match.index))
				);
			}

			const colorStr = match[0];
			if (isValidColor(colorStr)) {
				// Create wrapper for swatch + text
				const wrapper = document.createElement("span");
				wrapper.className = "cp-color-wrapper";

				// Always show swatch in reading view
				const swatch = document.createElement("span");
				swatch.className = "cp-color-swatch";
				swatch.style.backgroundColor = colorStr;
				swatch.setAttribute("data-color", colorStr);
				wrapper.appendChild(swatch);

				// Create text element - colorized based on settings
				const textElement = document.createElement("span");
				textElement.textContent = colorStr;
				textElement.setAttribute("data-color", colorStr);

				// Only colorize if enabled AND color won't be invisible
				if (
					settings.colorizeTextInEditor &&
					!isColorTooLight(colorStr) &&
					!isColorTooDark(colorStr)
				) {
					textElement.className = "cp-colored-text";
					textElement.style.color = colorStr;
				}

				wrapper.appendChild(textElement);
				fragment.appendChild(wrapper);
			} else {
				// Invalid color, add as plain text
				fragment.appendChild(document.createTextNode(colorStr));
			}

			lastIndex = match.index + colorStr.length;
		}

		// Add remaining text
		if (lastIndex < text.length) {
			fragment.appendChild(
				document.createTextNode(text.slice(lastIndex))
			);
		}

		textNode.replaceWith(fragment);
	}
}

/** Main plugin class */
export default class ColorPreviewPlugin extends Plugin {
	settings: ColorPreviewSettings = { ...DEFAULT_SETTINGS };
	private currentExtension: Extension | null = null;

	async onload() {
		await this.loadSettings();

		// Register editor extension
		this.registerEditorExtensions();

		// Register reading view processor
		this.registerMarkdownPostProcessor(
			(element: HTMLElement, _context: MarkdownPostProcessorContext) => {
				if (this.settings.enableInReadingView) {
					processReadingView(element, this.settings);
				}
			}
		);

		// Add settings tab
		this.addSettingTab(new ColorPreviewSettingTab(this.app, this));
	}

	private registerEditorExtensions() {
		this.currentExtension = createColorPreviewPlugin(this.settings);
		this.registerEditorExtension(this.currentExtension);
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);

		// Force refresh of all editor views
		this.app.workspace.iterateAllLeaves((leaf) => {
			if (leaf.view.getViewType() === "markdown") {
				const markdownView = leaf.view as any;
				if (markdownView.editor?.cm) {
					// Force CodeMirror to rebuild decorations
					const cm = markdownView.editor.cm;
					cm.dispatch({
						effects: [],
						changes: [],
					});
				}
			}
		});

		// Also refresh reading view by re-processing all markdown elements
		setTimeout(() => {
			document
				.querySelectorAll(".markdown-preview-view")
				.forEach((el) => {
					// Remove existing color previews
					el.querySelectorAll(
						".cp-color-wrapper, .cp-color-swatch"
					).forEach((colorEl) => {
						const parent = colorEl.parentNode;
						if (parent && colorEl.textContent) {
							parent.replaceChild(
								document.createTextNode(colorEl.textContent),
								colorEl
							);
						}
					});

					// Re-process if enabled
					if (this.settings.enableInReadingView) {
						processReadingView(el as HTMLElement, this.settings);
					}
				});
		}, 50);
	}
}

/** Settings tab */
class ColorPreviewSettingTab extends PluginSettingTab {
	constructor(app: App, private plugin: ColorPreviewPlugin) {
		super(app, plugin);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl("h2", { text: "Color Preview Settings" });

		new Setting(containerEl)
			.setName("Show color swatch")
			.setDesc("Display a small color preview chip before color values")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.showSwatchInEditor)
					.onChange(async (value) => {
						this.plugin.settings.showSwatchInEditor = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Colorize text")
			.setDesc(
				"Apply the actual color to the text (e.g., #ff0000 appears red)"
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.colorizeTextInEditor)
					.onChange(async (value) => {
						this.plugin.settings.colorizeTextInEditor = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Enable in reading view")
			.setDesc("Show color previews in the rendered markdown view")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.enableInReadingView)
					.onChange(async (value) => {
						this.plugin.settings.enableInReadingView = value;
						await this.plugin.saveSettings();
					})
			);
	}
}
