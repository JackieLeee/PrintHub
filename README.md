# PrintHub

> **中文：** [README.zh.md](./README.zh.md)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-20%2B-green?logo=node.js&logoColor=white)](https://nodejs.org/)
[![pnpm](https://img.shields.io/badge/pnpm-9%2B-F69220?logo=pnpm&logoColor=white)](https://pnpm.io/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)

## Background

Cash registers, POS apps, and label printers usually send **raw ESC/POS or TSPL** over TCP — not PDF or images. Without a physical printer, it is hard to tell whether the bytes are correct.

**PrintHub** acts as a **LAN virtual printer**: it accepts the same payloads as real hardware and shows them in a browser — live preview, history, samples, and raw debug submit.

## What it does

| Capability | Description |
|------------|-------------|
| **Receive** | ESC/POS receipts and TSPL labels on TCP **9100** |
| **Preview** | Canvas receipt/label preview — ESC/POS (text, images, Code128, QR) and TSPL labels |
| **History** | Recent jobs stored in the browser; replay and export (file / hex / Base64) |
| **Debug** | One-click ESC/POS & TSPL samples; File / Hex / Base64 raw print |

| Port | Role |
|------|------|
| **9100** | TCP — print data from POS or test tools |
| **8081** | HTTP + WebSocket + embedded Web UI |

## Usage

**Requirements:** Node.js 20+, pnpm 9+

```bash
pnpm install
pnpm dev      # build Web UI + start Bridge
# or: pnpm start   (build + run, no watch)
```

1. Open **http://localhost:8081** (or your machine’s LAN IP).
2. Point the POS / app at **`<host>:9100`**.
3. In the UI, try **Print ESC/POS Sample** or **Print TSPL Sample** to verify.

> **LAN access:** Other devices on the same network should use `http://<bridge-host>:8081`, not `localhost`.

**TCP smoke test:**

```bash
printf '\x1b@\x1ba\x01Hello PrintHub\n\x1dV\x00' | nc -N localhost 9100
```

**HTTP raw submit:**

```bash
curl -X POST http://localhost:8081/print/raw \
  -H "Content-Type: application/octet-stream" \
  --data-binary @sample.bin
```

## Architecture

![PrintHub architecture](./docs/assets/architecture.en.png)

**Monorepo layout**

- `packages/bridge` — TCP listener, HTTP API, WebSocket relay, static UI
- `packages/web` — React dashboard
- `packages/escpos`, `packages/tspl`, `packages/renderer` — parse and render (ESC/POS inspector parser, TSPL label meta, Code128/QR canvas drawing)
- `packages/shared`, `packages/relay-client` — types and WS client

One process (`pnpm dev` / `pnpm start`): Bridge builds and serves `apps/web/dist` on port **8081**.

## Star History

<a href="https://www.star-history.com/?repos=JackieLeee%2FPrintHub&type=date&legend=bottom-right">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=JackieLeee/PrintHub&type=date&theme=dark&legend=bottom-right&sealed_token=nZ7TJ03ductF3SiTo2_x9Ry8wmdRlWLIKmXdxoqRfHGkvFTL1NlWxsoL_mwD-dvCVfMZyzyZBzIM8Ihzq8OU20MkofoZvSxuyMsDOOtdZ4QVigSvLemN2CREu9Vshu8wZoD0fdcGEmLEiHpFYXfkdgGvjq8Zi8n1CIzMHumwS2FRSd_6JyewdE8DLc-K" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=JackieLeee/PrintHub&type=date&legend=bottom-right&sealed_token=nZ7TJ03ductF3SiTo2_x9Ry8wmdRlWLIKmXdxoqRfHGkvFTL1NlWxsoL_mwD-dvCVfMZyzyZBzIM8Ihzq8OU20MkofoZvSxuyMsDOOtdZ4QVigSvLemN2CREu9Vshu8wZoD0fdcGEmLEiHpFYXfkdgGvjq8Zi8n1CIzMHumwS2FRSd_6JyewdE8DLc-K" />
   <img alt="Star History Chart" src="https://api.star-history.com/chart?repos=JackieLeee/PrintHub&type=date&legend=bottom-right&sealed_token=nZ7TJ03ductF3SiTo2_x9Ry8wmdRlWLIKmXdxoqRfHGkvFTL1NlWxsoL_mwD-dvCVfMZyzyZBzIM8Ihzq8OU20MkofoZvSxuyMsDOOtdZ4QVigSvLemN2CREu9Vshu8wZoD0fdcGEmLEiHpFYXfkdgGvjq8Zi8n1CIzMHumwS2FRSd_6JyewdE8DLc-K" />
 </picture>
</a>

---

MIT License — see [LICENSE](./LICENSE).  
Contributing: [CONTRIBUTING.md](./CONTRIBUTING.md) · Security: [SECURITY.md](./SECURITY.md)
