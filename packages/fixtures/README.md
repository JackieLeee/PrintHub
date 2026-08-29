# @virt-printer/fixtures

Regression fixtures for ESC/POS and TSPL parse/render coverage.

## Layout

- `manifest.json` — fixture metadata and L2 expectations
- `escpos/*.bin` — binary print jobs
- `tspl/*.tspl` — label command files
- `src/snapshots.json` — L3 parse snapshots (committed)

## Commands

```bash
pnpm --filter @virt-printer/fixtures generate
pnpm --filter @virt-printer/fixtures test
UPDATE_SNAPSHOTS=1 pnpm --filter @virt-printer/fixtures test:update-snapshots
```

Current corpus: **11 ESC/POS** + **7 TSPL** fixtures covering GBK/UTF-8 receipts, GS v0 / ESC * images, cash drawer, QR/EAN13, TSPL BITMAP/BLOCK/shapes, and warehouse labels.

After parser changes that intentionally alter output, update snapshots and review the diff.
