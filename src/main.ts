import { Plugin, MarkdownPostProcessorContext } from 'obsidian';
import { ColorPreviewSettings, DEFAULT_SETTINGS } from './types';
import { createColorPreviewExtension } from './editor/editorExtension';
import { processReadingView } from './reading/readingViewProcessor';
import { ColorPreviewSettingTab } from './ui/settingsTab';

export default class ColorPreviewPlugin extends Plugin {
	settings: ColorPreviewSettings = { ...DEFAULT_SETTINGS };

	async onload(): Promise<void> {
		await this.loadSettings();

		// Live preview / source mode
		this.registerEditorExtension(
			createColorPreviewExtension(() => this.settings)
		);

		// Obsidian calls this once per block-level element. We hand each block to
		// a MarkdownRenderChild so Obsidian manages the mount/unmount lifecycle.
		this.registerMarkdownPostProcessor(
			(element: HTMLElement, context: MarkdownPostProcessorContext) => {
				if (this.settings.enableInReadingView) {
					processReadingView(element, context, this.settings);
				}
			}
		);

		this.addSettingTab(new ColorPreviewSettingTab(this.app, this));
	}

	onunload(): void {
		// all registered extensions and post-processors are
		// cleaned up automatically by the Plugin base class.
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);

		// Refresh editor views so the new settings take effect immediately.
		this.app.workspace.iterateAllLeaves((leaf) => {
			const view = leaf.view as any;
			if (view?.getViewType?.() === 'markdown' && view?.editor?.cm) {
				view.editor.cm.dispatch({});
			}
		});

		// Reading view: re-opening the note re-runs the post-processor naturally.
		// For an immediate refresh without closing the note, re-render the preview.
		this.app.workspace.iterateAllLeaves((leaf) => {
			const view = leaf.view as any;
			if (view?.getViewType?.() === 'markdown' && view?.previewMode) {
				view.previewMode.rerender(true);
			}
		});
	}
}
