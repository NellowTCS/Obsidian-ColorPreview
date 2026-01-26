import { findColorsInText, hasGoodContrast, isValidColor } from '../utils/colorParser';
import type { ColorPreviewSettings } from '../types';

/**
 * Check if a node should be processed
 */
function shouldProcessNode(node: Node): boolean {
	// Skip code blocks
	if (node.parentElement?.closest('code, pre')) {
		return false;
	}

	// Skip already processed nodes
	if (node.parentElement?.classList.contains('cp-color-wrapper')) {
		return false;
	}

	// Skip if no text content
	if (!node.nodeValue) {
		return false;
	}

	return true;
}

/**
 * Remove all existing color preview elements
 */
function cleanupExistingPreviews(element: HTMLElement): void {
	const previews = element.querySelectorAll('.cp-color-wrapper');
	
	previews.forEach((wrapper) => {
		const textContent = wrapper.textContent || '';
		const textNode = document.createTextNode(textContent);
		wrapper.parentNode?.replaceChild(textNode, wrapper);
	});

	// Normalize adjacent text nodes
	element.normalize();
}

/**
 * Create a color preview wrapper element
 */
function createColorElement(
	colorStr: string,
	settings: ColorPreviewSettings
): HTMLElement {
	const wrapper = document.createElement('span');
	wrapper.className = 'cp-color-wrapper';

	// Add swatch
	const swatch = document.createElement('span');
	swatch.className = 'cp-color-swatch';
	swatch.style.backgroundColor = colorStr;
	swatch.setAttribute('data-color', colorStr);
	swatch.setAttribute('aria-label', `Color preview: ${colorStr}`);
	wrapper.appendChild(swatch);

	// Add text
	const textSpan = document.createElement('span');
	textSpan.textContent = colorStr;
	textSpan.setAttribute('data-color', colorStr);

	// Apply coloring if enabled and has good contrast
	if (settings.colorizeTextInEditor && hasGoodContrast(colorStr)) {
		textSpan.className = 'cp-colored-text';
		textSpan.style.color = colorStr;
	}

	wrapper.appendChild(textSpan);
	return wrapper;
}

/**
 * Process a single text node
 */
function processTextNode(
	textNode: Text,
	settings: ColorPreviewSettings
): void {
	const text = textNode.nodeValue || '';
	const matches = findColorsInText(text);

	if (matches.length === 0) {
		return;
	}

	const fragment = document.createDocumentFragment();
	let lastIndex = 0;

	for (const match of matches) {
		// Add text before match
		if (match.from > lastIndex) {
			fragment.appendChild(
				document.createTextNode(text.slice(lastIndex, match.from))
			);
		}

		// Add color element
		fragment.appendChild(createColorElement(match.color, settings));

		lastIndex = match.to;
	}

	// Add remaining text
	if (lastIndex < text.length) {
		fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
	}

	// Replace the text node with the fragment
	textNode.parentNode?.replaceChild(fragment, textNode);
}

/**
 * Collect all text nodes that need processing
 */
function collectTextNodes(element: HTMLElement): Text[] {
	const textNodes: Text[] = [];
	const walker = document.createTreeWalker(
		element,
		NodeFilter.SHOW_TEXT,
		{
			acceptNode: (node) => {
				return shouldProcessNode(node)
					? NodeFilter.FILTER_ACCEPT
					: NodeFilter.FILTER_REJECT;
			},
		}
	);

	let node: Node | null;
	while ((node = walker.nextNode())) {
		textNodes.push(node as Text);
	}

	return textNodes;
}

/**
 * Process reading view to add color previews
 */
export function processReadingView(
	element: HTMLElement,
	settings: ColorPreviewSettings
): void {
	// Clean up any existing previews first
	cleanupExistingPreviews(element);

	// Collect text nodes to process
	const textNodes = collectTextNodes(element);

	// Process each text node
	for (const textNode of textNodes) {
		try {
			processTextNode(textNode, settings);
		} catch (error) {
			console.error('ColorPreview: Error processing text node', error);
		}
	}
}

/**
 * Clear all color previews from an element
 */
export function clearReadingView(element: HTMLElement): void {
	cleanupExistingPreviews(element);
}