/**
 * Represents a parsed color with its position in text
 */
export interface ColorMatch {
	from: number;
	to: number;
	color: string;
	original: string;
}

/**
 * Color format patterns with strict boundaries
 */
const COLOR_PATTERNS = {
	hex3: /\b#[0-9a-fA-F]{3}\b/g,
	hex4: /\b#[0-9a-fA-F]{4}\b/g,
	hex6: /\b#[0-9a-fA-F]{6}\b/g,
	hex8: /\b#[0-9a-fA-F]{8}\b/g,
	rgb: /\brgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)/gi,
	rgba: /\brgba\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*(?:0|1|0?\.\d+)\s*\)/gi,
	hsl: /\bhsl\(\s*\d{1,3}\s*,\s*\d{1,3}%\s*,\s*\d{1,3}%\s*\)/gi,
	hsla: /\bhsla\(\s*\d{1,3}\s*,\s*\d{1,3}%\s*,\s*\d{1,3}%\s*,\s*(?:0|1|0?\.\d+)\s*\)/gi,
};

/**
 * Validates if a color string is renderable in CSS
 */
export function isValidColor(colorStr: string): boolean {
	if (!colorStr || typeof colorStr !== 'string') {
		return false;
	}

	// Quick format check before DOM test
	const trimmed = colorStr.trim();
	if (!trimmed) return false;

	const testElement = document.createElement('div');
	testElement.style.color = '';
	testElement.style.color = trimmed;
	
	const isValid = testElement.style.color !== '';
	
	return isValid;
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
 * Uses non-overlapping pattern matching to prevent jumbled results
 */
export function findColorsInText(text: string, startOffset = 0): ColorMatch[] {
	const matches: ColorMatch[] = [];
	const processedRanges = new Set<string>();

	// Helper to check if a range overlaps with any processed range
	const isOverlapping = (start: number, end: number): boolean => {
		for (let i = start; i < end; i++) {
			if (processedRanges.has(i.toString())) {
				return true;
			}
		}
		return false;
	};

	// Helper to mark a range as processed
	const markRange = (start: number, end: number): void => {
		for (let i = start; i < end; i++) {
			processedRanges.add(i.toString());
		}
	};

	// Process each pattern type in order of specificity (longer patterns first)
	const orderedPatterns: Array<[string, RegExp]> = [
		['hex8', COLOR_PATTERNS.hex8],
		['hex6', COLOR_PATTERNS.hex6],
		['hex4', COLOR_PATTERNS.hex4],
		['hex3', COLOR_PATTERNS.hex3],
		['hsla', COLOR_PATTERNS.hsla],
		['hsl', COLOR_PATTERNS.hsl],
		['rgba', COLOR_PATTERNS.rgba],
		['rgb', COLOR_PATTERNS.rgb],
	];

	for (const [, pattern] of orderedPatterns) {
		pattern.lastIndex = 0;
		let match: RegExpExecArray | null;

		while ((match = pattern.exec(text)) !== null) {
			const matchStart = match.index;
			const matchEnd = match.index + match[0].length;

			// Skip if this range overlaps with an already processed range
			if (isOverlapping(matchStart, matchEnd)) {
				continue;
			}

			const colorStr = match[0];

			if (isValidColor(colorStr)) {
				matches.push({
					from: startOffset + matchStart,
					to: startOffset + matchEnd,
					color: colorStr,
					original: colorStr,
				});

				// Mark this range as processed
				markRange(matchStart, matchEnd);
			}
		}
	}

	// Sort by position
	return matches.sort((a, b) => a.from - b.from);
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