/*
 * Represents a parsed color with its position in text
 */
export interface ColorMatch {
	from: number;
	to: number;
	color: string;
	original: string;
}

/**
 * Combined regex that matches all color formats
 * Uses alternation with careful ordering (longest/most specific first)
 */
const COMBINED_COLOR_REGEX = 
	/#[0-9a-fA-F]{8}(?![0-9a-fA-F])|#[0-9a-fA-F]{6}(?![0-9a-fA-F])|#[0-9a-fA-F]{4}(?![0-9a-fA-F])|#[0-9a-fA-F]{3}(?![0-9a-fA-F])|rgba?\s*\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)|hsla?\s*\(\s*\d{1,3}\s*,\s*\d{1,3}%\s*,\s*\d{1,3}%\s*(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)/gi;

/**
 * Validates if a color string is renderable in CSS
 */
export function isValidColor(colorStr: string): boolean {
	if (!colorStr || typeof colorStr !== 'string') {
		return false;
	}

	const trimmed = colorStr.trim();
	if (!trimmed) return false;

	const testElement = document.createElement('div');
	testElement.style.color = '';
	testElement.style.color = trimmed;
	
	return testElement.style.color !== '';
}

/**
 * Calculates perceived brightness (luminance) of a color
 */
export function calculateLuminance(colorStr: string): number {
	const testElement = document.createElement('div');
	testElement.style.color = colorStr;
	document.body.appendChild(testElement);

	const computedColor = getComputedStyle(testElement).color;
	document.body.removeChild(testElement);

	const rgbMatch = computedColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
	if (!rgbMatch) return 0.5;

	const [, r, g, b] = rgbMatch.map(Number);
	return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/**
 * Determines if a color is too light for visibility
 */
export function isColorTooLight(colorStr: string, threshold = 0.85): boolean {
	return calculateLuminance(colorStr) > threshold;
}

/**
 * Determines if a color is too dark for visibility
 */
export function isColorTooDark(colorStr: string, threshold = 0.15): boolean {
	return calculateLuminance(colorStr) < threshold;
}

/**
 * Checks if color has sufficient contrast for colorization
 */
export function hasGoodContrast(colorStr: string): boolean {
	return !isColorTooLight(colorStr) && !isColorTooDark(colorStr);
}

/**
 * Finds all valid color matches in a text string
 * Uses a single combined regex to prevent overlapping matches
 */
export function findColorsInText(text: string, startOffset = 0): ColorMatch[] {
	const matches: ColorMatch[] = [];
	
	// Reset regex state
	COMBINED_COLOR_REGEX.lastIndex = 0;
	
	let match: RegExpExecArray | null;
	
	while ((match = COMBINED_COLOR_REGEX.exec(text)) !== null) {
		const colorStr = match[0];
		
		// Validate the color is actually renderable
		if (isValidColor(colorStr)) {
			matches.push({
				from: startOffset + match.index,
				to: startOffset + match.index + colorStr.length,
				color: colorStr,
				original: colorStr,
			});
		}
	}

	return matches;
}

/**
 * Normalizes a color string to a consistent format
 */
export function normalizeColor(colorStr: string): string {
	const testElement = document.createElement('div');
	testElement.style.color = colorStr;
	document.body.appendChild(testElement);
	const normalized = getComputedStyle(testElement).color;
	document.body.removeChild(testElement);
	return normalized || colorStr;
}
