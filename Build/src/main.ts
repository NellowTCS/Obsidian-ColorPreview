import { Plugin, PluginSettingTab, Setting } from "obsidian";
import { EditorView, Decoration, DecorationSet, ViewPlugin, ViewUpdate, WidgetType } from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";

// Plugin Settings Interface
interface ColorPreviewSettings {
    useColoredText: boolean;
    showInCodeBlocks: boolean;
    previewSize: number;
    showColorNames: boolean;
    borderStyle: 'solid' | 'none' | 'dotted';
    previewPosition: 'before' | 'after' | 'replace';
}

// Default Settings
const DEFAULT_SETTINGS: ColorPreviewSettings = {
    useColoredText: false,
    showInCodeBlocks: false,
    previewSize: 12,
    showColorNames: true,
    borderStyle: 'solid',
    previewPosition: 'before',
};

/**
 * Enhanced regex matcher for various color formats
 * Supports: hex (3,4,6,8 digits), rgb, rgba, hsl, hsla, named colors
 */
const colorRegex = /(\\?#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8}))|(rgba?\(\s*(?:\d{1,3}(?:\.\d+)?%?|\d*\.\d+%?)\s*,\s*(?:\d{1,3}(?:\.\d+)?%?|\d*\.\d+%?)\s*,\s*(?:\d{1,3}(?:\.\d+)?%?|\d*\.\d+%?)\s*(?:,\s*(?:0|0?\.\d+|1(?:\.0+)?))?\s*\))|(hsla?\(\s*(?:\d{1,3}(?:\.\d+)?)\s*,\s*(?:\d{1,3}(?:\.\d+)?%)\s*,\s*(?:\d{1,3}(?:\.\d+)?%)\s*(?:,\s*(?:0|0?\.\d+|1(?:\.0+)?))?\s*\))|(?:\b(?:red|green|blue|yellow|orange|purple|pink|brown|black|white|gray|grey|cyan|magenta|lime|maroon|navy|olive|teal|silver|aqua|fuchsia|indigo|violet|gold|coral|salmon|khaki|plum|orchid|crimson|azure|beige|bisque|chocolate|firebrick|forestgreen|hotpink|lavender|lightblue|lightgreen|lightgray|lightpink|lightyellow|mediumblue|mediumseagreen|midnightblue|orange|orangered|palegreen|peachpuff|rosybrown|royalblue|seagreen|skyblue|slateblue|slategray|springgreen|steelblue|tomato|turquoise|wheat|whitesmoke|yellowgreen)\b)/gi;

/**
 * CSS named colors for validation
 */
const namedColors = new Set([
    'red', 'green', 'blue', 'yellow', 'orange', 'purple', 'pink', 'brown', 'black', 'white',
    'gray', 'grey', 'cyan', 'magenta', 'lime', 'maroon', 'navy', 'olive', 'teal', 'silver',
    'aqua', 'fuchsia', 'indigo', 'violet', 'gold', 'coral', 'salmon', 'khaki', 'plum', 'orchid',
    'crimson', 'azure', 'beige', 'bisque', 'chocolate', 'firebrick', 'forestgreen', 'hotpink',
    'lavender', 'lightblue', 'lightgreen', 'lightgray', 'lightpink', 'lightyellow', 'mediumblue',
    'mediumseagreen', 'midnightblue', 'orangered', 'palegreen', 'peachpuff', 'rosybrown',
    'royalblue', 'seagreen', 'skyblue', 'slateblue', 'slategray', 'springgreen', 'steelblue',
    'tomato', 'turquoise', 'wheat', 'whitesmoke', 'yellowgreen'
]);

export default class ColorPreviewPlugin extends Plugin {
    settings: ColorPreviewSettings;

    async onload() {
        await this.loadSettings();
        console.log("Color Preview Plugin loaded");

        this.addSettingTab(new ColorPreviewSettingTab(this.app, this));

        // Reading Mode processor
        this.registerMarkdownPostProcessor((element) => {
            this.addReadingModePreviews(element);
        });

        // Live Preview decorations
        this.registerEditorExtension(colorPreviewPlugin(this));

        // Add CSS styles
        this.addStyles();
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
        this.updateStyles();
    }

    addStyles() {
        const style = document.createElement('style');
        style.id = 'color-preview-plugin-styles';
        this.updateStyleContent(style);
        document.head.appendChild(style);
    }

    updateStyles() {
        const existingStyle = document.getElementById('color-preview-plugin-styles');
        if (existingStyle) {
            this.updateStyleContent(existingStyle);
        }
    }

    updateStyleContent(styleElement: HTMLElement) {
        const borderStyle = this.settings.borderStyle === 'none' ? 'none' : 
                           this.settings.borderStyle === 'dotted' ? '1px dotted var(--text-muted)' : 
                           '1px solid var(--text-muted)';
        
        styleElement.textContent = `
            .color-preview-block {
                display: inline-flex;
                align-items: center;
                gap: 4px;
                margin: 0 2px;
                vertical-align: middle;
            }
            
            .color-preview-block .color-square {
                display: inline-block;
                width: ${this.settings.previewSize}px;
                height: ${this.settings.previewSize}px;
                border: ${borderStyle};
                border-radius: 2px;
                flex-shrink: 0;
                box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.1);
                transition: transform 0.1s ease;
            }
            
            .color-preview-block .color-square:hover {
                transform: scale(1.2);
                z-index: 10;
                position: relative;
            }
            
            .color-preview-block .color-label {
                font-size: 0.9em;
                opacity: 0.8;
            }
            
            .color-preview-replace {
                display: inline-flex;
                align-items: center;
                gap: 2px;
                background: var(--background-secondary);
                padding: 1px 4px;
                border-radius: 3px;
                border: 1px solid var(--background-modifier-border);
            }
            
            .color-preview-colored-text {
                font-weight: 500;
                text-shadow: 0 0 1px rgba(0, 0, 0, 0.3);
            }
        `;
    }

    /**
     * Validates if a color string is valid
     */
    isValidColor(color: string): boolean {
        if (namedColors.has(color.toLowerCase())) {
            return true;
        }
        
        // Create a temporary element to test color validity
        const testElement = document.createElement('div');
        testElement.style.color = color;
        return testElement.style.color !== '';
    }

    /**
     * Normalizes color format for display
     */
    normalizeColor(colorRaw: string): string {
        return colorRaw.startsWith("\\") ? colorRaw.slice(1) : colorRaw;
    }

    /**
     * Creates color preview element for reading mode
     */
    createColorPreview(color: string): DocumentFragment | HTMLElement {
        if (this.settings.useColoredText) {
            const span = document.createElement("span");
            span.className = "color-preview-colored-text";
            span.style.color = color;
            span.textContent = this.settings.showColorNames ? color : "";
            return span;
        }

        if (this.settings.previewPosition === 'replace') {
            const wrapper = document.createElement("span");
            wrapper.className = "color-preview-replace";

            const blockWrapper = document.createElement("span");
            blockWrapper.className = "color-preview-block";

            const block = document.createElement("span");
            block.className = "color-square";
            block.style.backgroundColor = color;
            block.title = `Color: ${color}`;

            blockWrapper.appendChild(block);

            if (this.settings.showColorNames) {
                const label = document.createElement("span");
                label.className = "color-label";
                label.textContent = color;
                blockWrapper.appendChild(label);
            }

            wrapper.appendChild(blockWrapper);
            return wrapper;
        } else {
            const fragment = document.createDocumentFragment();
            
            const blockWrapper = document.createElement("span");
            blockWrapper.className = "color-preview-block";

            const block = document.createElement("span");
            block.className = "color-square";
            block.style.backgroundColor = color;
            block.title = `Color: ${color}`;

            blockWrapper.appendChild(block);

            if (this.settings.showColorNames) {
                const label = document.createElement("span");
                label.className = "color-label";
                label.textContent = color;
                blockWrapper.appendChild(label);
            }

            fragment.appendChild(blockWrapper);
            if (this.settings.previewPosition === 'after' && this.settings.showColorNames) {
                fragment.appendChild(document.createTextNode(color));
            }
            return fragment;
        }
    }

    addReadingModePreviews(el: HTMLElement) {
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        let node: Text | null;

        while ((node = walker.nextNode() as Text | null)) {
            const parent = node.parentElement;
            if (!parent) continue;

            // Skip code blocks unless setting allows
            const isInCode = parent.tagName === "CODE" || parent.tagName === "PRE" || 
                           parent.closest('code') || parent.closest('pre');
            if (isInCode && !this.settings.showInCodeBlocks) continue;

            const text = node.nodeValue;
            if (!text) continue;

            const matches = [...text.matchAll(colorRegex)];
            if (matches.length === 0) continue;

            const fragment = document.createDocumentFragment();
            let lastIndex = 0;

            for (const match of matches) {
                const colorRaw = match[0];
                const color = this.normalizeColor(colorRaw);
                const start = match.index || 0;

                // Validate color
                if (!this.isValidColor(color)) continue;

                // Add text before match
                if (start > lastIndex) {
                    fragment.appendChild(document.createTextNode(text.slice(lastIndex, start)));
                }

                // Add color preview
                const preview = this.createColorPreview(color);
                if (this.settings.previewPosition === 'replace') {
                    fragment.appendChild(preview as HTMLElement);
                } else {
                    fragment.appendChild(preview as DocumentFragment);
                    if (this.settings.previewPosition === 'after') {
                        // Original text is shown, preview is added after
                        fragment.appendChild(document.createTextNode(colorRaw));
                    }
                }

                lastIndex = start + colorRaw.length;
            }

            // Add remaining text
            if (lastIndex < text.length) {
                fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
            }

            parent.replaceChild(fragment, node);
        }
    }

    onunload() {
        // Clean up styles
        const styleElement = document.getElementById('color-preview-plugin-styles');
        if (styleElement) {
            styleElement.remove();
        }
    }
}

// ---------------- Live Preview CodeMirror Plugin ----------------

const colorPreviewPlugin = (pluginInstance: ColorPreviewPlugin) =>
    ViewPlugin.fromClass(
        class {
            decorations: DecorationSet;

            constructor(view: EditorView) {
                this.decorations = this.buildDecorations(view);
            }

            update(update: ViewUpdate) {
                if (update.docChanged || update.viewportChanged) {
                    this.decorations = this.buildDecorations(update.view);
                }
            }

            buildDecorations(view: EditorView) {
                const builder = new RangeSetBuilder<Decoration>();

                for (const { from, to } of view.visibleRanges) {
                    const text = view.state.doc.sliceString(from, to);
                    const matches = [...text.matchAll(colorRegex)];

                    for (const match of matches) {
                        const colorRaw = match[0];
                        const color = pluginInstance.normalizeColor(colorRaw);
                        const start = from + (match.index || 0);

                        // Skip invalid colors
                        if (!pluginInstance.isValidColor(color)) continue;

                        // Skip code blocks unless setting allows
                        const lineText = view.state.doc.lineAt(start).text;
                        const isInCode = lineText.includes('```') || lineText.trim().startsWith('    ');
                        if (isInCode && !pluginInstance.settings.showInCodeBlocks) continue;

                        if (pluginInstance.settings.useColoredText) {
                            const deco = Decoration.mark({
                                attributes: { 
                                    style: `color: ${color}; font-weight: 500; text-shadow: 0 0 1px rgba(0, 0, 0, 0.3);`,
                                    class: 'color-preview-colored-text'
                                },
                            });
                            builder.add(start, start + colorRaw.length, deco);
                        } else {
                            const position = pluginInstance.settings.previewPosition === 'after' ? 1 : -1;
                            const deco = Decoration.widget({
                                widget: new ColorWidget(color, pluginInstance.settings),
                                side: position,
                            });
                            
                            const insertPos = pluginInstance.settings.previewPosition === 'after' ? 
                                            start + colorRaw.length : start;
                            builder.add(insertPos, insertPos, deco);
                        }
                    }
                }

                return builder.finish();
            }
        },
        {
            decorations: (v) => v.decorations,
        }
    );

class ColorWidget extends WidgetType {
    color: string;
    settings: ColorPreviewSettings;

    constructor(color: string, settings: ColorPreviewSettings) {
        super();
        this.color = color;
        this.settings = settings;
    }

    toDOM() {
        const wrapper = document.createElement("span");
        wrapper.className = "color-preview-block";
        wrapper.style.display = "inline-flex";
        wrapper.style.alignItems = "center";
        wrapper.style.gap = "4px";
        wrapper.style.margin = "0 2px";

        const square = document.createElement("span");
        square.className = "color-square";
        square.style.display = "inline-block";
        square.style.width = `${this.settings.previewSize}px`;
        square.style.height = `${this.settings.previewSize}px`;
        square.style.borderRadius = "2px";
        square.style.backgroundColor = this.color;
        square.style.flexShrink = "0";
        square.title = `Color: ${this.color}`;

        // Apply border style
        if (this.settings.borderStyle === 'none') {
            square.style.border = 'none';
        } else if (this.settings.borderStyle === 'dotted') {
            square.style.border = '1px dotted #666';
        } else {
            square.style.border = '1px solid #666';
        }

        wrapper.appendChild(square);

        // Add label if enabled
        if (this.settings.showColorNames && this.settings.previewPosition !== 'replace') {
            const label = document.createElement("span");
            label.className = "color-label";
            label.style.fontSize = "0.9em";
            label.style.opacity = "0.8";
            label.textContent = this.color;
            wrapper.appendChild(label);
        }

        return wrapper;
    }

    ignoreEvent() {
        return true;
    }
}

// ---------------- Settings Tab ----------------

class ColorPreviewSettingTab extends PluginSettingTab {
    plugin: ColorPreviewPlugin;

    constructor(app: any, plugin: ColorPreviewPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl("h2", { text: "Color Preview Settings" });

        // Preview style setting
        new Setting(containerEl)
            .setName("Preview Style")
            .setDesc("Choose how colors are displayed")
            .addDropdown((dropdown) =>
                dropdown
                    .addOption("blocks", "Color blocks with labels")
                    .addOption("colored-text", "Colored text")
                    .setValue(this.plugin.settings.useColoredText ? "colored-text" : "blocks")
                    .onChange(async (value) => {
                        this.plugin.settings.useColoredText = value === "colored-text";
                        await this.plugin.saveSettings();
                        this.plugin.app.workspace.trigger("refresh");
                    })
            );

        // Preview position setting (only for block style)
        if (!this.plugin.settings.useColoredText) {
            new Setting(containerEl)
                .setName("Preview Position")
                .setDesc("Where to show the color preview")
                .addDropdown((dropdown) =>
                    dropdown
                        .addOption("before", "Before color text")
                        .addOption("after", "After color text")
                        .addOption("replace", "Replace color text")
                        .setValue(this.plugin.settings.previewPosition)
                        .onChange(async (value) => {
                            this.plugin.settings.previewPosition = value as 'before' | 'after' | 'replace';
                            await this.plugin.saveSettings();
                            this.plugin.app.workspace.trigger("refresh");
                        })
                );
        }

        // Preview size setting
        new Setting(containerEl)
            .setName("Preview Size")
            .setDesc("Size of color preview squares in pixels")
            .addSlider((slider) =>
                slider
                    .setLimits(8, 24, 1)
                    .setValue(this.plugin.settings.previewSize)
                    .setDynamicTooltip()
                    .onChange(async (value) => {
                        this.plugin.settings.previewSize = value;
                        await this.plugin.saveSettings();
                        this.plugin.app.workspace.trigger("refresh");
                    })
            );

        // Border style setting
        new Setting(containerEl)
            .setName("Border Style")
            .setDesc("Style of border around color previews")
            .addDropdown((dropdown) =>
                dropdown
                    .addOption("solid", "Solid border")
                    .addOption("dotted", "Dotted border")
                    .addOption("none", "No border")
                    .setValue(this.plugin.settings.borderStyle)
                    .onChange(async (value) => {
                        this.plugin.settings.borderStyle = value as 'solid' | 'none' | 'dotted';
                        await this.plugin.saveSettings();
                        this.plugin.app.workspace.trigger("refresh");
                    })
            );

        // Show color names setting
        new Setting(containerEl)
            .setName("Show Color Names")
            .setDesc("Display color values alongside previews")
            .addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.settings.showColorNames)
                    .onChange(async (value) => {
                        this.plugin.settings.showColorNames = value;
                        await this.plugin.saveSettings();
                        this.plugin.app.workspace.trigger("refresh");
                    })
            );

        // Show in code blocks setting
        new Setting(containerEl)
            .setName("Show in Code Blocks")
            .setDesc("Enable color previews inside code blocks and inline code")
            .addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.settings.showInCodeBlocks)
                    .onChange(async (value) => {
                        this.plugin.settings.showInCodeBlocks = value;
                        await this.plugin.saveSettings();
                        this.plugin.app.workspace.trigger("refresh");
                    })
            );

        // Add a sample section
        containerEl.createEl("h3", { text: "Preview Examples" });
        const exampleEl = containerEl.createEl("div", { 
            text: "Sample colors: #ff0000 rgb(0, 255, 0) hsl(240, 100%, 50%) blue",
            cls: "setting-item-description"
        });
        
        // Apply previews to the sample
        setTimeout(() => {
            this.plugin.addReadingModePreviews(exampleEl);
        }, 100);
    }
}