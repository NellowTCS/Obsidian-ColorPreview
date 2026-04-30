import { App, PluginSettingTab, Setting } from "obsidian";
import type ColorPreviewPlugin from "../main";

export class ColorPreviewSettingTab extends PluginSettingTab {
	constructor(
		app: App,
		private readonly plugin: ColorPreviewPlugin,
	) {
		super(app, plugin);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl).setName("Configuration").setHeading();

		new Setting(containerEl)
			.setName("Show color swatch")
			.setDesc("Display a small colored square before color values")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.showSwatchInEditor)
					.onChange(async (value) => {
						this.plugin.settings.showSwatchInEditor = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Colorize text")
			.setDesc(
				"Apply the color to the text itself (e.g., #ff0000 appears in red). " +
					"Colors with low contrast against the current theme background will not be colorized.",
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.colorizeTextInEditor)
					.onChange(async (value) => {
						this.plugin.settings.colorizeTextInEditor = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Enable in reading view")
			.setDesc("Show color previews when viewing rendered Markdown")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.enableInReadingView)
					.onChange(async (value) => {
						this.plugin.settings.enableInReadingView = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Supported color formats")
			.setHeading();

		new Setting(containerEl).setDesc(
			"Hex: #RGB, #rrggbb, #rgba, #rrggbbaa · rgb/rgba: rgb(255, 0, 0) · hsl/hsla: hsl(120, 100%, 50%)",
		);
	}
}
