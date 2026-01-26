// src/ui/settingsTab.ts

import { App, PluginSettingTab, Setting } from 'obsidian';
import type ColorPreviewPlugin from '../main';

/**
 * Settings tab for the Color Preview plugin
 */
export class ColorPreviewSettingTab extends PluginSettingTab {
	constructor(
		app: App,
		private readonly plugin: ColorPreviewPlugin
	) {
		super(app, plugin);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		// Header
		containerEl.createEl('h2', { text: 'Color Preview Settings' });

		// Description
		containerEl.createEl('p', {
			text: 'Configure how color values are displayed in your notes.',
			cls: 'setting-item-description',
		});

		// Show color swatch setting
		new Setting(containerEl)
			.setName('Show color swatch')
			.setDesc('Display a small colored square before color values')
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.showSwatchInEditor)
					.onChange(async (value) => {
						this.plugin.settings.showSwatchInEditor = value;
						await this.plugin.saveSettings();
					})
			);

		// Colorize text setting
		new Setting(containerEl)
			.setName('Colorize text')
			.setDesc(
				'Apply the color to the text itself (e.g., #ff0000 appears in red). ' +
				'Very light or dark colors will not be colorized for readability.'
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.colorizeTextInEditor)
					.onChange(async (value) => {
						this.plugin.settings.colorizeTextInEditor = value;
						await this.plugin.saveSettings();
					})
			);

		// Enable in reading view setting
		new Setting(containerEl)
			.setName('Enable in reading view')
			.setDesc('Show color previews when viewing rendered markdown')
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.enableInReadingView)
					.onChange(async (value) => {
						this.plugin.settings.enableInReadingView = value;
						await this.plugin.saveSettings();
					})
			);

		// Supported formats info
		containerEl.createDiv({ cls: 'setting-item-description' }, (div) => {
			div.createEl('h3', { text: 'Supported Color Formats', cls: 'u-font-weight-bold' });
			div.createEl('ul', {}, (ul) => {
				ul.createEl('li', { text: 'HEX: #RGB, #RRGGBB, #RGBA, #RRGGBBAA' });
				ul.createEl('li', { text: 'RGB: rgb(255, 0, 0)' });
				ul.createEl('li', { text: 'RGBA: rgba(255, 0, 0, 0.5)' });
				ul.createEl('li', { text: 'HSL: hsl(120, 100%, 50%)' });
				ul.createEl('li', { text: 'HSLA: hsla(120, 100%, 50%, 0.5)' });
			});
		});
	}
}