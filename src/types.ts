// src/types.ts

/**
 * Plugin settings interface
 */
export interface ColorPreviewSettings {
	/** Show color swatch in editor */
	showSwatchInEditor: boolean;

	/** Colorize the text itself in editor */
	colorizeTextInEditor: boolean;

	/** Enable color previews in reading view */
	enableInReadingView: boolean;
}

/**
 * Default settings
 */
export const DEFAULT_SETTINGS: ColorPreviewSettings = {
	showSwatchInEditor: true,
	colorizeTextInEditor: false,
	enableInReadingView: true,
};

/**
 * Constants
 */
export const PLUGIN_NAME = "Color Preview";
export const PLUGIN_ID = "color-preview";

/**
 * CSS class names
 */
export const CSS_CLASSES = {
	swatch: "cp-color-swatch",
	coloredText: "cp-colored-text",
	wrapper: "cp-color-wrapper",
} as const;
