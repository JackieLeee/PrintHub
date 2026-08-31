# PrintHub

> **中文：** [README.zh.md](./README.zh.md)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Release](https://img.shields.io/github/v/release/JackieLeee/PrintHub?label=release)](https://github.com/JackieLeee/PrintHub/releases)
[![Node.js](https://img.shields.io/badge/Node.js-20%2B-green?logo=node.js&logoColor=white)](https://nodejs.org/)
[![pnpm](https://img.shields.io/badge/pnpm-9%2B-F69220?logo=pnpm&logoColor=white)](https://pnpm.io/)

LAN **virtual printer** for **ESC/POS** receipts and **TSPL** labels — receive raw TCP print jobs, preview in the browser, replay history, and debug without hardware.

**New in v1.1.0:** Inspector ↔ preview linkage · PNG/PDF export · `@virt-printer/analyze` for agents · Star dialect detection · expanded command reference & fixture corpus.

## Features

| | |
|---|---|
| **Inspector** | Grouped command blocks (Setup / Preview / composite) linked to canvas highlight |
| **Export** | PNG & PDF (label-sized), Hex / Base64 / commands / raw payload |
| **Analyze** | `printhub-analyze` CLI — JSON `commands`, `blocks`, `summary` for agents & CI |
| **Preview** | ESC/POS & TSPL canvas rendering; Star dialect badge; last **50** jobs |
| **Debug** | Samples + File / Hex / Base64 — works **offline** without Bridge |
| **Workbench** | Virtual printer · Network & ports · Debug print · Printer sim · Command ref |
| **Desktop** | Electron + Bridge, tray, EN/中文, optional LAN HTTP |
| **Discovery** | mDNS `_pdl-datastream._tcp` on **9100** |

**Ports:** TCP **9100** (print, always on) · HTTP **8081** (Web UI + API; CLI always on, desktop optional)

## Download

[Releases](https://github.com/JackieLeee/PrintHub/releases) · [Web demo](https://jackieleee.github.io/PrintHub/) (UI only, no TCP)

| Platform | File |
|----------|------|
| macOS (Apple Silicon) | `*-mac-arm64.dmg` ~110 MB |
| macOS (Intel) | `*-mac-x64.dmg` ~110 MB |
| Windows x64 | `*-win-x64.exe` ~99 MB |

> **Unsigned builds.** macOS: right-click → **Open**. Windows: **More info → Run anyway**.

## Quick start

**Node.js 20+ · pnpm 9+**

```bash
pnpm install
pnpm dev          # CLI: Web UI + Bridge on :8081
pnpm dev:desktop  # Electron app
```

1. Open **http://localhost:8081** (LAN: `http://<host>:8081`)
2. Point POS at **`<host>:9100`**

```bash
# TCP smoke test
printf '\x1b@\x1ba\x01Hello PrintHub\n\x1dV\x00' | nc -N localhost 9100
```

**Packaging:** `pnpm dist:desktop` (macOS) · `pnpm dist:desktop:win` (Windows)

| Workbench | Preview & history | Debug print |
|:---:|:---:|:---:|
| ![Workbench](./docs/assets/desktop-workbench.png) | ![Preview](./docs/assets/desktop-preview-history.png) | ![Debug](./docs/assets/desktop-debug-tspl.png) |

## Architecture

![Architecture](./docs/assets/architecture.en.png)

`apps/desktop` · `apps/web` · `packages/bridge` · `packages/{escpos,tspl,renderer,analyze,fixtures}` · `packages/{shared,relay-client}`

**Analyze (CLI):** `pnpm exec printhub-analyze path/to/job.bin`

---

MIT · [CONTRIBUTING](./CONTRIBUTING.md) · [SECURITY](./SECURITY.md)

<a href="https://www.star-history.com/?repos=JackieLeee%2FPrintHub&type=date&legend=bottom-right">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=JackieLeee/PrintHub&type=date&theme=dark&legend=bottom-right&sealed_token=nZ7TJ03ductF3SiTo2_x9Ry8wmdRlWLIKmXdxoqRfHGkvFTL1NlWxsoL_mwD-dvCVfMZyzyZBzIM8Ihzq8OU20MkofoZvSxuyMsDOOtdZ4QVigSvLemN2CREu9Vshu8wZoD0fdcGEmLEiHpFYXfkdgGvjq8Zi8n1CIzMHumwS2FRSd_6JyewdE8DLc-K" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=JackieLeee/PrintHub&type=date&legend=bottom-right&sealed_token=nZ7TJ03ductF3SiTo2_x9Ry8wmdRlWLIKmXdxoqRfHGkvFTL1NlWxsoL_mwD-dvCVfMZyzyZBzIM8Ihzq8OU20MkofoZvSxuyMsDOOtdZ4QVigSvLemN2CREu9Vshu8wZoD0fdcGEmLEiHpFYXfkdgGvjq8Zi8n1CIzMHumwS2FRSd_6JyewdE8DLc-K" />
   <img alt="Star History" src="https://api.star-history.com/chart?repos=JackieLeee/PrintHub&type=date&legend=bottom-right&sealed_token=nZ7TJ03ductF3SiTo2_x9Ry8wmdRlWLIKmXdxoqRfHGkvFTL1NlWxsoL_mwD-dvCVfMZyzyZBzIM8Ihzq8OU20MkofoZvSxuyMsDOOtdZ4QVigSvLemN2CREu9Vshu8wZoD0fdcGEmLEiHpFYXfkdgGvjq8Zi8n1CIzMHumwS2FRSd_6JyewdE8DLc-K" />
 </picture>
</a>
