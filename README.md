# Obsidian-ColorPreview

[![GitHub contributors from allcontributors.org](https://img.shields.io/github/all-contributors/NellowTCS/Obsidian-ColorPreview)](#contributors)
![GitHub Actions Workflow Status](https://img.shields.io/github/actions/workflow/status/NellowTCS/Obsidian-ColorPreview/release.yml)
![GitHub License](https://img.shields.io/github/license/NellowTCS/Obsidian-ColorPreview)

Preview HEX, HSL, and RGB colors directly in your Obsidian notes, just like VSCode's color preview.

## Features

- **Color preview**: Instantly see color swatches for HEX, RGB(A), and HSL(A) values in your notes
- **Live in editor and reading view**: Works in both editing and preview modes
- **Customizable**: Toggle swatches, text colorization, and supported formats
- **Contrast-aware**: Only colorizes text if it remains readable
- **Performance optimized**: Efficiently processes large notes

## Supported Formats

- HEX: `#RGB`, `#RRGGBB`, `#RGBA`, `#RRGGBBAA`
- RGB/RGBA: `rgb(255, 0, 0)`, `rgba(255, 0, 0, 0.5)`
- HSL/HSLA: `hsl(120, 100%, 50%)`, `hsla(120, 100%, 50%, 0.5)`

## Settings

- **Show color swatch**: Display a small colored square before color values
- **Colorize text**: Apply the color to the text itself (if contrast is good)
- **Enable in reading view**: Show previews in rendered Markdown
- **Supported color formats**: Toggle which color formats are recognized

## Example

Type any of these in your note:

```
#ff0000
rgb(255, 0, 0)
hsl(0, 100%, 50%)
```

And see a color preview appear inline!

## Installation

(WIP)

## Technical Details

- Built with TypeScript and CodeMirror 6
- Uses Obsidian's popout-compatible `activeDocument` for DOM operations
- Efficient regex-based color detection

## Star History

<a href="https://www.star-history.com/#NellowTCS/Obsidian-ColorPreview&Date">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=NellowTCS/Obsidian-ColorPreview&type=Date&theme=dark" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=NellowTCS/Obsidian-ColorPreview&type=Date" />
   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=NellowTCS/Obsidian-ColorPreview&type=Date" />
 </picture>
</a>

## Contributors

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->

<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

<!-- ALL-CONTRIBUTORS-LIST:END -->
