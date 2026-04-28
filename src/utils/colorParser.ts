export interface ColorMatch {
	from: number;
	to: number;
	color: string;
	original: string;
}

// Regex patterns — compiled once, cloned per-call via new RegExp() so callers
// never share lastIndex state.
const HEX_PATTERN =
	/#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})(?![0-9a-fA-F])/;

const RGB_PATTERN =
	/rgba?\(\s*(?:25[0-5]|2[0-4]\d|1?\d{1,2})\s*,\s*(?:25[0-5]|2[0-4]\d|1?\d{1,2})\s*,\s*(?:25[0-5]|2[0-4]\d|1?\d{1,2})(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)/;

const HSL_PATTERN =
	/hsla?\(\s*(?:36[0]|3[0-5]\d|[12]?\d{1,2})\s*,\s*(?:100|\d{1,2})%\s*,\s*(?:100|\d{1,2})%(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)/;

const COMBINED_SOURCE = [HEX_PATTERN, RGB_PATTERN, HSL_PATTERN]
	.map((r) => r.source)
	.join('|');

function parseHex(hex: string): [number, number, number, number] | null {
	const h = hex.slice(1);
	let r: number, g: number, b: number, a = 255;
	if (h.length === 3) {
		r = parseInt(h[0] + h[0], 16);
		g = parseInt(h[1] + h[1], 16);
		b = parseInt(h[2] + h[2], 16);
	} else if (h.length === 4) {
		r = parseInt(h[0] + h[0], 16);
		g = parseInt(h[1] + h[1], 16);
		b = parseInt(h[2] + h[2], 16);
		a = parseInt(h[3] + h[3], 16);
	} else if (h.length === 6) {
		r = parseInt(h.slice(0, 2), 16);
		g = parseInt(h.slice(2, 4), 16);
		b = parseInt(h.slice(4, 6), 16);
	} else if (h.length === 8) {
		r = parseInt(h.slice(0, 2), 16);
		g = parseInt(h.slice(2, 4), 16);
		b = parseInt(h.slice(4, 6), 16);
		a = parseInt(h.slice(6, 8), 16);
	} else {
		return null;
	}
	return [r, g, b, a];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
	s /= 100;
	l /= 100;
	const k = (n: number) => (n + h / 30) % 12;
	const a = s * Math.min(l, 1 - l);
	const f = (n: number) =>
		l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
	return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

/**
 * Converts a color string to [r, g, b, a]
 * Returns null for unparseable strings.
 */
function colorToRgba(colorStr: string): [number, number, number, number] | null {
	const s = colorStr.trim();

	if (s.startsWith('#')) {
		return parseHex(s);
	}

	const funcMatch = s.match(
		/^(rgba?|hsla?)\(\s*([^)]+)\)/i
	);
	if (!funcMatch) return null;

	const fn = funcMatch[1].toLowerCase();
	const parts = funcMatch[2].split(',').map((p) => p.trim());

	if (fn === 'rgb' || fn === 'rgba') {
		const r = parseInt(parts[0]);
		const g = parseInt(parts[1]);
		const b = parseInt(parts[2]);
		const a = parts[3] !== undefined ? parseFloat(parts[3]) * 255 : 255;
		if ([r, g, b].some((v) => isNaN(v) || v < 0 || v > 255)) return null;
		return [r, g, b, a];
	}

	if (fn === 'hsl' || fn === 'hsla') {
		const h = parseFloat(parts[0]);
		const sv = parts[1].replace('%', '');
		const lv = parts[2].replace('%', '');
		const s2 = parseFloat(sv);
		const l2 = parseFloat(lv);
		const a2 = parts[3] !== undefined ? parseFloat(parts[3]) * 255 : 255;
		if (isNaN(h) || isNaN(s2) || isNaN(l2)) return null;
		if (s2 < 0 || s2 > 100 || l2 < 0 || l2 > 100) return null;
		const [r, g, b] = hslToRgb(h, s2, l2);
		return [r, g, b, a2];
	}

	return null;
}

// Validates if a color string is parseable
export function isValidColor(colorStr: string): boolean {
	return colorToRgba(colorStr) !== null;
}

// Calculates perceived luminance (0–1)
export function calculateLuminance(colorStr: string): number {
	const rgba = colorToRgba(colorStr);
	if (!rgba) return 0.5;
	const [r, g, b] = rgba;
	return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

export function isColorTooLight(colorStr: string, threshold = 0.85): boolean {
	return calculateLuminance(colorStr) > threshold;
}

export function isColorTooDark(colorStr: string, threshold = 0.15): boolean {
	return calculateLuminance(colorStr) < threshold;
}

export function hasGoodContrast(colorStr: string): boolean {
	return !isColorTooLight(colorStr) && !isColorTooDark(colorStr);
}

// Finds all valid color matches in a text string.
export function findColorsInText(text: string, startOffset = 0): ColorMatch[] {
	const matches: ColorMatch[] = [];
	const regex = new RegExp(COMBINED_SOURCE, 'gi');

	let match: RegExpExecArray | null;
	while ((match = regex.exec(text)) !== null) {
		const colorStr = match[0];
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
