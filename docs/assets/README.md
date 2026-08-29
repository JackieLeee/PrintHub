# Docs assets

| File | Used in |
|------|---------|
| `architecture.en.png` | [README.md](../../README.md) |
| `architecture.zh.png` | [README.zh.md](../../README.zh.md) |
| `architecture.en.svg` | Source for EN diagram (edit + re-export PNG) |
| `architecture.zh.svg` | Source for ZH diagram (edit + re-export PNG) |
| `desktop-workbench.png` | README desktop screenshots |
| `desktop-preview-history.png` | README desktop screenshots |
| `desktop-debug-tspl.png` | README desktop screenshots |

Re-export PNG after editing SVG:

```bash
rsvg-convert -w 1400 docs/assets/architecture.en.svg -o docs/assets/architecture.en.png
rsvg-convert -w 1400 docs/assets/architecture.zh.svg -o docs/assets/architecture.zh.png
```
