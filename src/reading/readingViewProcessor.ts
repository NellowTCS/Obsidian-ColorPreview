import { findColorsInText, hasGoodContrast } from '../utils/colorParser';
import type { ColorPreviewSettings } from '../types';

// Helpers
function shouldProcessNode(node: Node): boolean {
	if (!node.nodeValue?.trim()) return false;
	// Skip code/pre blocks
	if ((node as Text).parentElement?.closest('code, pre')) return false;
	// Skip already-processed wrappers
	if ((node as Text).parentElement?.classList.contains('cp-color-wrapper')) return false;
	return true;
}

function cleanupExistingPreviews(root: HTMLElement): void {
	// Replace each wrapper with its plain-text content, then normalize.
	root.querySelectorAll('.cp-color-wrapper').forEach((wrapper) => {
		const text = document.createTextNode(wrapper.textContent ?? '');
		wrapper.parentNode?.replaceChild(text, wrapper);
	});
	root.normalize();
}

function createColorElement(colorStr: string, settings: ColorPreviewSettings): HTMLElement {
	const wrapper = document.createElement('span');
	wrapper.className = 'cp-color-wrapper';

	if (settings.showSwatchInEditor) {
		const swatch = document.createElement('span');
		swatch.className = 'cp-color-swatch';
		swatch.style.backgroundColor = colorStr;
		swatch.setAttribute('aria-label', `Color: ${colorStr}`);
		wrapper.appendChild(swatch);
	}

	const label = document.createElement('span');
	label.textContent = colorStr;

	if (settings.colorizeTextInEditor && hasGoodContrast(colorStr)) {
		label.className = 'cp-colored-text';
		label.style.color = colorStr;
	}

	wrapper.appendChild(label);
	return wrapper;
}

function processTextNode(node: Text, settings: ColorPreviewSettings): void {
	const text = node.nodeValue ?? '';
	const matches = findColorsInText(text);
	if (matches.length === 0) return;

	const fragment = document.createDocumentFragment();
	let cursor = 0;

	for (const match of matches) {
		if (match.from > cursor) {
			fragment.appendChild(document.createTextNode(text.slice(cursor, match.from)));
		}
		fragment.appendChild(createColorElement(match.color, settings));
		cursor = match.to;
	}

	if (cursor < text.length) {
		fragment.appendChild(document.createTextNode(text.slice(cursor)));
	}

	node.parentNode?.replaceChild(fragment, node);
}

// Public API
export function processReadingView(root: HTMLElement, settings: ColorPreviewSettings): void {
	cleanupExistingPreviews(root);

	// Collect all text nodes before touching the DOM, mutating the tree
	// while a TreeWalker is active causes nodes to be skipped.
	const textNodes: Text[] = [];
	const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
		acceptNode: (node) =>
			shouldProcessNode(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT,
	});

	let n: Node | null;
	while ((n = walker.nextNode())) {
		textNodes.push(n as Text);
	}

	// Now mutate
	for (const node of textNodes) {
		try {
			processTextNode(node, settings);
		} catch (err) {
			console.error('ColorPreview: Error processing text node', err);
		}
	}
}

export function clearReadingView(root: HTMLElement): void {
	cleanupExistingPreviews(root);
}
