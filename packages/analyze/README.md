# @virt-printer/analyze

Structured, JSON-serializable analysis of ESC/POS and TSPL print payloads — designed for **agents, CLI tools, and CI**.

## Quick start

```bash
# CLI (from repo root after pnpm install)
pnpm exec printhub-analyze packages/fixtures/escpos/demo-receipt.bin

# Programmatic
import { analyzePrintPayload } from "@virt-printer/analyze";

const result = analyzePrintPayload(new Uint8Array(await readFile("job.bin")));
console.log(result.protocol, result.commandCount, result.unsupportedByteRatio);
```

## Response shape (`PrintAnalysis`)

| Field | Description |
|-------|-------------|
| `schemaVersion` | Always `1` — bump when breaking |
| `protocol` | `"escpos"` \| `"tspl"` |
| `dialect` | For ESC/POS: `"standard"` \| `"star"` (Star column bitmap / ESC GS extensions) |
| `byteLength` | Raw payload size |
| `paperWidth` | Inferred ESC/POS width (dots), when applicable |
| `commandCount` | Parsed command count |
| `unsupportedCount` / `unsupportedBytes` / `unsupportedByteRatio` | Unrecognized bytes |
| `warnings` | Parser warnings (TSPL BITMAP gaps, etc.) |
| `commands[]` | Flat list: `id`, `category`, `label`, `offset`, `length`, `detail`, `previewable` |
| `blocks[]` | Inspector groupings: `setup` / `drawable` / `composite` with `highlightId` |
| `summary` | `{ categories, hasText, hasBarcode, hasQrCode, hasImage, hasRaster }` |

## Agent usage notes

1. **Prefer `blocks` over raw `commands`** when explaining jobs to users — merged QR sequences, text+style groups, TSPL setup batches.
2. **`highlightId`** maps to renderer preview regions (same IDs as web Inspector).
3. **`unsupportedByteRatio > 0.05`** usually means incomplete protocol coverage — flag for human review.
4. **Round-trip**: combine with `@virt-printer/escpos` / `@virt-printer/tspl` parsers for hex-level debugging.

## Related packages

- `@virt-printer/escpos` — ESC/POS parser
- `@virt-printer/tspl` — TSPL parser
- `@virt-printer/renderer` — Canvas preview
- `@virt-printer/fixtures` — Regression corpus
