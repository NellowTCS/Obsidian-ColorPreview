import { MarkdownRenderChild } from 'obsidian';
import { findColorsInText, hasGoodContrast } from '../utils/colorParser';
import type { ColorPreviewSettings } from '../types';
import type { MarkdownPostProcessorContext } from 'obsidian';

// Wraps a single paragraph element (<p>, <li>, etc.) that contains color strings
class ColorSpanChild extends MarkdownRenderChild {
	constructor(
		containerEl: HTMLElement,
		private readonly settings: ColorPreviewSettings,
	) {
		super(containerEl);
	}

	onload(): void {
		this.processElement(this.containerEl);
	}

	onunload(): void {
		// replace every .cp-color-wrapper with its text content to restore
		this.containerEl.querySelectorAll('.cp-color-wrapper').forEach((wrapper) => {
			wrapper.replaceWith(document.createTextNode(wrapper.textContent ?? ''));
		});
		this.containerEl.normalize();
	}

	private processElement(root: HTMLElement): void {
		// Mutating the tree while a TreeWalker is active causes nodes to be skipped or revisited.
		const textNodes = this.collectTextNodes(root);
		for (const node of textNodes) {
			this.processTextNode(node);
		}
	}

	private collectTextNodes(root: HTMLElement): Text[] {
		const nodes: Text[] = [];
		const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
			acceptNode: (node) => {
				if (!node.nodeValue?.trim()) return NodeFilter.FILTER_REJECT;
				if ((node as Text).parentElement?.closest('code, pre')) return NodeFilter.FILTER_REJECT;
				if ((node as Text).parentElement?.classList.contains('cp-color-wrapper')) return NodeFilter.FILTER_REJECT;
				return NodeFilter.FILTER_ACCEPT;
			},
		});
		let n: Node | null;
		while ((n = walker.nextNode())) nodes.push(n as Text);
		return nodes;
	}

	private processTextNode(node: Text): void {
		const text = node.nodeValue ?? '';
		const matches = findColorsInText(text);
		if (matches.length === 0) return;

		const fragment = document.createDocumentFragment();
		let cursor = 0;

		for (const match of matches) {
			if (match.from > cursor) {
				fragment.appendChild(document.createTextNode(text.slice(cursor, match.from)));
			}
			fragment.appendChild(this.createColorElement(match.color));
			cursor = match.to;
		}
		if (cursor < text.length) {
			fragment.appendChild(document.createTextNode(text.slice(cursor)));
		}

		node.parentNode?.replaceChild(fragment, node);
	}

	private createColorElement(color: string): HTMLElement {
		const wrapper = document.createElement('span');
		wrapper.className = 'cp-color-wrapper';

		if (this.settings.showSwatchInEditor) {
			const swatch = document.createElement('span');
			swatch.className = 'cp-color-swatch';
			swatch.style.backgroundColor = color;
			swatch.setAttribute('aria-label', `Color: ${color}`);
			wrapper.appendChild(swatch);
		}

		const label = document.createElement('span');
		label.textContent = color;

		if (this.settings.colorizeTextInEditor && hasGoodContrast(color)) {
			label.className = 'cp-colored-text';
			label.style.color = color;
		}

		wrapper.appendChild(label);
		return wrapper;
	}
}

// Call processReadingView from registerMarkdownPostProcessor.
// Pass the context so Obsidian can manage the child's lifecycle automatically.
export function processReadingView(
	element: HTMLElement,
	context: MarkdownPostProcessorContext,
	settings: ColorPreviewSettings,
): void {
	// registerMarkdownPostProcessor receives one block-level element at a time
	// (a <p>, <ul>, <h1>, etc.). We register one ColorSpanChild per block.
	// Obsidian calls onload() immediately and onunload() when it's removed.
	context.addChild(new ColorSpanChild(element, settings));
}
