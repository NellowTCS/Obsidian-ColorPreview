export interface ColorMatch {
	from: number;
	to: number;
	color: string;
	original: string;
}

// Regex
const HEX_PATTERN =
	/#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})(?![0-9a-fA-F])/;

const RGB_PATTERN =
	/rgba?\(\s*(?:25[0-5]|2[0-4]\d|1?\d{1,2})\s*,\s*(?:25[0-5]|2[0-4]\d|1?\d{1,2})\s*,\s*(?:25[0-5]|2[0-4]\d|1?\d{1,2})(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)/;

const HSL_PATTERN =
	/hsla?\(\s*(?:36[0]|3[0-5]\d|[12]?\d{1,2})\s*,\s*(?:100|\d{1,2})%\s*,\s*(?:100|\d{1,2})%(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)/;

const COMBINED_SOURCE = [HEX_PATTERN, RGB_PATTERN, HSL_PATTERN]
	.map((r) => r.source)
	.join("|");

// Parsing
function parseHex(hex: string): [number, number, number, number] | null {
	const h = hex.slice(1);
	let r: number,
		g: number,
		b: number,
		a = 255;
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
	return [
		Math.round(f(0) * 255),
		Math.round(f(8) * 255),
		Math.round(f(4) * 255),
	];
}

function colorToRgba(
	colorStr: string,
): [number, number, number, number] | null {
	const s = colorStr.trim();
	if (!s) return null;

	if (s.startsWith("#")) return parseHex(s);

	const funcMatch = s.match(/^(rgba?|hsla?)\(\s*([^)]+)\)/i);
	if (!funcMatch) return null;

	const fn = funcMatch[1].toLowerCase();
	const parts = funcMatch[2].split(",").map((p) => p.trim());

	if (fn === "rgb" || fn === "rgba") {
		const r = parseInt(parts[0]);
		const g = parseInt(parts[1]);
		const b = parseInt(parts[2]);
		const a = parts[3] !== undefined ? parseFloat(parts[3]) * 255 : 255;
		if ([r, g, b].some((v) => isNaN(v) || v < 0 || v > 255)) return null;
		return [r, g, b, a];
	}

	if (fn === "hsl" || fn === "hsla") {
		const h = parseFloat(parts[0]);
		const s2 = parseFloat(parts[1]);
		const l2 = parseFloat(parts[2]);
		const a2 = parts[3] !== undefined ? parseFloat(parts[3]) * 255 : 255;
		if (isNaN(h) || isNaN(s2) || isNaN(l2)) return null;
		if (s2 < 0 || s2 > 100 || l2 < 0 || l2 > 100) return null;
		const [r, g, b] = hslToRgb(h, s2, l2);
		return [r, g, b, a2];
	}

	return null;
}

// Theme background
let cachedBg: [number, number, number] | null = null;
let cacheScheduled = false;

function invalidateBgCache() {
	cachedBg = null;
	cacheScheduled = false;
}

function getThemeBackground(): [number, number, number] {
	if (cachedBg) return cachedBg;

	const raw = getComputedStyle(window.activeDocument.body)
		.getPropertyValue("--background-primary")
		.trim();

	const parsed = colorToRgba(raw);

	if (parsed) {
		cachedBg = [parsed[0], parsed[1], parsed[2]];
	} else {
		// Unparseable format (oklch, color-mix, etc.)
		const isDark = window.activeDocument.body.classList.contains("theme-dark");
		cachedBg = isDark ? [30, 30, 30] : [255, 255, 255];
	}

	if (!cacheScheduled) {
		cacheScheduled = true;
		window.requestAnimationFrame(invalidateBgCache);
	}

	return cachedBg;
}

// WCAG contrast
function toLinear(c: number): number {
	const s = c / 255;
	return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function relativeLuminance(r: number, g: number, b: number): number {
	return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function contrastRatio(
	[r1, g1, b1]: [number, number, number],
	[r2, g2, b2]: [number, number, number],
): number {
	const l1 = relativeLuminance(r1, g1, b1);
	const l2 = relativeLuminance(r2, g2, b2);
	const lighter = Math.max(l1, l2);
	const darker = Math.min(l1, l2);
	return (lighter + 0.05) / (darker + 0.05);
}

export function hasGoodContrast(colorStr: string): boolean {
	const rgba = colorToRgba(colorStr);
	if (!rgba) return false;
	const bg = getThemeBackground();
	return contrastRatio([rgba[0], rgba[1], rgba[2]], bg) >= 3.0;
}

// Public helpers
export function isValidColor(colorStr: string): boolean {
	return colorToRgba(colorStr) !== null;
}

export function findColorsInText(text: string, startOffset = 0): ColorMatch[] {
	const matches: ColorMatch[] = [];
	const regex = new RegExp(COMBINED_SOURCE, "gi");

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
