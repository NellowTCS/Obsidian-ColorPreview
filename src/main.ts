import { Plugin, MarkdownView, MarkdownPostProcessorContext } from "obsidian";
import { IroViewSettings, DEFAULT_SETTINGS } from "./types";
import { createIroViewExtension } from "./editor/editorExtension";
import { processReadingView } from "./reading/readingViewProcessor";
import { IroViewSettingTab } from "./ui/settingsTab";
import type { EditorView } from "@codemirror/view";

export default class IroViewPlugin extends Plugin {
	settings: IroViewSettings = { ...DEFAULT_SETTINGS };

	async onload(): Promise<void> {
		await this.loadSettings();

		this.registerEditorExtension(
			createIroViewExtension(() => this.settings),
		);

		this.registerMarkdownPostProcessor(
			(element: HTMLElement, context: MarkdownPostProcessorContext) => {
				if (this.settings.enableInReadingView) {
					processReadingView(element, context, this.settings);
				}
			},
		);

		this.addSettingTab(new IroViewSettingTab(this.app, this));
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			(await this.loadData()) as Partial<IroViewSettings>,
		);
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);

		// Nudge all open editor views to re-evaluate their decorations.
		this.app.workspace.iterateAllLeaves((leaf) => {
			const view = leaf.view;
			if (view instanceof MarkdownView) {
				// editor.cm is not in the public API types but is stable
				const cm = (view.editor as unknown as { cm?: EditorView }).cm;
				if (cm) cm.dispatch({});
			}
		});

		// Re-render reading view panes so post-processors run again with new settings.
		this.app.workspace.iterateAllLeaves((leaf) => {
			const view = leaf.view;
			if (view instanceof MarkdownView) {
				// previewMode.rerender is not in public types
				const preview = (
					view as unknown as {
						previewMode?: { rerender: (full: boolean) => void };
					}
				).previewMode;
				if (preview) preview.rerender(true);
			}
		});
	}
}
