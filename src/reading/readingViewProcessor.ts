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
					// ownerDocument targets the element's own window; correct for
					// pop-out windows. prefer-active-doc doesn't recognise this pattern.
					// eslint-disable-next-line obsidianmd/prefer-active-doc
					(wrapper.ownerDocument ?? document).createTextNode(
						wrapper.textContent ?? "",
					),
				);
			});
		this.containerEl.normalize();
	}

	private get doc(): Document {
		// ownerDocument of the container is always the right document for the
		// window this element lives in
		// eslint-disable-next-line obsidianmd/prefer-active-doc
		return this.containerEl.ownerDocument ?? document;
	}

	private collectTextNodes(root: HTMLElement): Text[] {
		const nodes: Text[] = [];
		const walker = this.doc.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
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

		const fragment = this.doc.createDocumentFragment();
		let cursor = 0;

		for (const match of matches) {
			if (match.from > cursor) {
				fragment.appendChild(
					this.doc.createTextNode(text.slice(cursor, match.from)),
				);
			}
			fragment.appendChild(this.createColorElement(match.color));
			cursor = match.to;
		}
		if (cursor < text.length) {
			fragment.appendChild(this.doc.createTextNode(text.slice(cursor)));
		}

		node.parentNode?.replaceChild(fragment, node);
	}

	private createColorElement(color: string): HTMLElement {
		const wrapper = this.doc.createElement("span");
		wrapper.className = "cp-color-wrapper";

		if (this.settings.showSwatchInEditor) {
			const swatch = this.doc.createElement("span");
			swatch.className = "cp-color-swatch";
			swatch.setAttribute("aria-label", `Color: ${color}`);
			swatch.setCssProps({ "--cp-swatch-color": color });
			wrapper.appendChild(swatch);
		}

		const label = this.doc.createElement("span");
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
