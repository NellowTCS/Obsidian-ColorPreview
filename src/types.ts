// src/types.ts

/**
 * Plugin settings interface
 */
export interface IroViewSettings {
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
export const DEFAULT_SETTINGS: IroViewSettings = {
	showSwatchInEditor: true,
	colorizeTextInEditor: false,
	enableInReadingView: true,
};

/**
 * Constants
 */
export const PLUGIN_NAME = "IroView";
export const PLUGIN_ID = "iroview";

/**
 * CSS class names
 */
export const CSS_CLASSES = {
	swatch: "cp-color-swatch",
	coloredText: "cp-colored-text",
	wrapper: "cp-color-wrapper",
} as const;
