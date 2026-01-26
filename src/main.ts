// src/main.ts

import { Plugin, MarkdownPostProcessorContext } from 'obsidian';
import type { Extension } from '@codemirror/state';
import { ColorPreviewSettings, DEFAULT_SETTINGS } from './types';
import { createColorPreviewExtension } from './editor/editorExtension';
import { processReadingView, clearReadingView } from './reading/readingViewProcessor';
import { ColorPreviewSettingTab } from './ui/settingsTab';

export default class ColorPreviewPlugin extends Plugin {
	settings: ColorPreviewSettings = { ...DEFAULT_SETTINGS };
	private editorExtension: Extension | null = null;

	// Plugin initialization
	async onload(): Promise<void> {
		console.log('Loading Color Preview plugin');

		await this.loadSettings();

		// Register editor extension for live preview
		this.initializeEditorExtension();

		// Register markdown post-processor for reading view
		this.registerMarkdownPostProcessor(
			(element: HTMLElement, _context: MarkdownPostProcessorContext) => {
				this.processMarkdownElement(element);
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
	 * Initialize the CodeMirror editor extension
	 */
	private initializeEditorExtension(): void {
		this.editorExtension = createColorPreviewExtension(() => this.settings);
		this.registerEditorExtension(this.editorExtension);
	}

	/**
	 * Process a markdown element in reading view
	 */
	private processMarkdownElement(element: HTMLElement): void {
		if (this.settings.enableInReadingView) {
			processReadingView(element, this.settings);
		}
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
		await this.saveData(this.settings);
		await this.refreshAllViews();
	}

	/**
	 * Refresh all editor and reading views
	 */
	private async refreshAllViews(): Promise<void> {
		// Refresh editor views
		this.refreshEditorViews();

		// Refresh reading views with a small delay
		setTimeout(() => {
			this.refreshReadingViews();
		}, 50);
	}

	/**
	 * Force refresh of all CodeMirror editor views
	 */
	private refreshEditorViews(): void {
		this.app.workspace.iterateAllLeaves((leaf) => {
			if (leaf.view.getViewType() === 'markdown') {
				const markdownView = leaf.view as any;
				
				if (markdownView.editor?.cm) {
					const cm = markdownView.editor.cm;
					// Dispatch empty transaction to trigger decoration rebuild
					cm.dispatch({
						effects: [],
						changes: [],
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
