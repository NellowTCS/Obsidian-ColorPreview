import { MarkdownRenderChild } from "obsidian";
import { findColorsInText, hasGoodContrast } from "../utils/colorParser";
import type { ColorPreviewSettings } from "../types";
import type { MarkdownPostProcessorContext } from "obsidian";

class ColorSpanChild extends MarkdownRenderChild {
	constructor(
		containerEl: HTMLElement,
		private readonly settings: ColorPreviewSettings,
	) {
		super(containerEl);
	}

	onload(): void {
		const textNodes = this.collectTextNodes(this.containerEl);
		for (const node of textNodes) {
			this.processTextNode(node);
		}
	}

	onunload(): void {
		this.containerEl
			.querySelectorAll(".cp-color-wrapper")
			.forEach((wrapper) => {
				wrapper.replaceWith(
					document.createTextNode(wrapper.textContent ?? ""),
				);
			});
		this.containerEl.normalize();
	}

	private collectTextNodes(root: HTMLElement): Text[] {
		const nodes: Text[] = [];
		const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
			acceptNode: (node) => {
				if (!node.nodeValue?.trim()) return NodeFilter.FILTER_REJECT;
				if ((node as Text).parentElement?.closest("code, pre"))
					return NodeFilter.FILTER_REJECT;
				if (
					(node as Text).parentElement?.classList.contains(
						"cp-color-wrapper",
					)
				)
					return NodeFilter.FILTER_REJECT;
				return NodeFilter.FILTER_ACCEPT;
			},
		});
		let n: Node | null;
		while ((n = walker.nextNode())) nodes.push(n as Text);
		return nodes;
	}

	private processTextNode(node: Text): void {
		const text = node.nodeValue ?? "";
		const matches = findColorsInText(text);
		if (matches.length === 0) return;

		const fragment = document.createDocumentFragment();
		let cursor = 0;

		for (const match of matches) {
			if (match.from > cursor) {
				fragment.appendChild(
					document.createTextNode(text.slice(cursor, match.from)),
				);
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
		const wrapper = document.createElement("span");
		wrapper.className = "cp-color-wrapper";

		if (this.settings.showSwatchInEditor) {
			const swatch = document.createElement("span");
			swatch.className = "cp-color-swatch";
			swatch.setAttribute("aria-label", `Color: ${color}`);
			swatch.setCssProps({ "--cp-swatch-color": color });
			wrapper.appendChild(swatch);
		}

		const label = document.createElement("span");
		label.textContent = color;

		if (this.settings.colorizeTextInEditor && hasGoodContrast(color)) {
			label.className = "cp-colored-text";
			label.setCssProps({ "--cp-text-color": color });
		}

		wrapper.appendChild(label);
		return wrapper;
	}
}

export function processReadingView(
	element: HTMLElement,
	context: MarkdownPostProcessorContext,
	settings: ColorPreviewSettings,
): void {
	context.addChild(new ColorSpanChild(element, settings));
}
