import { Plugin, MarkdownPostProcessorContext } from 'obsidian';
import { ColorPreviewSettings, DEFAULT_SETTINGS } from './types';
import { createColorPreviewExtension } from './editor/editorExtension';
import { processReadingView, clearReadingView } from './reading/readingViewProcessor';
import { ColorPreviewSettingTab } from './ui/settingsTab';

export default class ColorPreviewPlugin extends Plugin {
	settings: ColorPreviewSettings = { ...DEFAULT_SETTINGS };

	/**
	 * Plugin initialization
	 */
	async onload(): Promise<void> {
		console.log('Loading Color Preview plugin');

		await this.loadSettings();

		// Register editor extension for live preview
		// Pass the settings object directly - it will be read reactively
		this.registerEditorExtension(
			createColorPreviewExtension(() => this.settings)
		);

		// Register markdown post-processor for reading view
		this.registerMarkdownPostProcessor(
			(element: HTMLElement, _context: MarkdownPostProcessorContext) => {
				if (this.settings.enableInReadingView) {
					processReadingView(element, this.settings);
				}
			}
		);

		// Add settings tab
		this.addSettingTab(new ColorPreviewSettingTab(this.app, this));
	}

	/**
	 * Plugin cleanup
	 */
	onunload(): void {
		console.log('Unloading Color Preview plugin');
	}

	/**
	 * Load plugin settings
	 */
	async loadSettings(): Promise<void> {
		const data = await this.loadData();
		this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
	}

	/**
	 * Save plugin settings and refresh views
	 */
	async saveSettings(): Promise<void> {
		console.log('ColorPreview: Saving settings', this.settings);
		await this.saveData(this.settings);
		
		// Force refresh of all editor views
		this.refreshEditorViews();

		// Refresh reading views with a small delay
		setTimeout(() => {
			this.refreshReadingViews();
		}, 100);
	}

	/**
	 * Force refresh of all CodeMirror editor views
	 */
	private refreshEditorViews(): void {
		this.app.workspace.iterateAllLeaves((leaf) => {
			const view = leaf.view;
			
			if (view.getViewType() === 'markdown') {
				const markdownView = view as any;
				
				if (markdownView.editor?.cm) {
					const cm = markdownView.editor.cm;
					
					// Force a full viewport update
					cm.requestMeasure();
					
					// Dispatch an empty transaction to trigger decoration rebuild
					cm.dispatch({
						effects: [],
					});
				}
			}
		});
	}

	/**
	 * Refresh all reading view elements
	 */
	private refreshReadingViews(): void {
		const readingViews = document.querySelectorAll('.markdown-preview-view');

		readingViews.forEach((element) => {
			const htmlElement = element as HTMLElement;
			
			// Clear existing previews
			clearReadingView(htmlElement);

			// Re-process if enabled
			if (this.settings.enableInReadingView) {
				processReadingView(htmlElement, this.settings);
			}
		});
	}
}
