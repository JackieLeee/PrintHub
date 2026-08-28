# PrintHub

> **中文：** [README.zh.md](./README.zh.md)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Release](https://img.shields.io/github/v/release/JackieLeee/PrintHub?label=release)](https://github.com/JackieLeee/PrintHub/releases)
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
| **Preview** | Canvas receipt/label preview — ESC/POS (text, images, Code128, QR, invert, cash-drawer markers) and TSPL labels |
| **History** | Recent jobs stored in the browser (last **50**); replay and export (file / hex / Base64); total count in sidebar |
| **Debug** | One-click ESC/POS & TSPL samples; File / Hex / Base64 raw submit — **works offline** (local preview without Bridge) |
| **Command reference** | Collapsible ESC/POS & TSPL command manuals in the debug panel (chevron expand/collapse) |
| **Themes & i18n** | 10 UI themes with **English / 中文** labels; language switcher in the header toolbar |
| **Printer sim** | Scenario simulation (normal, paper-out, cover-open, offline, slow, reject-job), DLE EOT status bytes, cash-drawer kick detection, live event log (last **50**) |
| **Desktop app** | Electron app with Bridge built-in, menu-bar tray, optional LAN HTTP/WebSocket |
| **mDNS** | Advertises `_pdl-datastream._tcp` on port **9100** for POS / macOS printer discovery |

| Port | Role |
|------|------|
| **9100** | TCP — print data from POS or test tools (always on) |
| **8081** | HTTP + WebSocket + embedded Web UI (optional in desktop; always on in CLI mode) |

### Desktop app (macOS)

Bridge runs inside the Electron app. TCP **9100** is always available; LAN HTTP is **off by default** and can be enabled from the menu-bar tray.

**v1.0.0** ships **macOS arm64** (`.dmg`) only — Windows builds are planned for a later release. Download from [Releases](https://github.com/JackieLeee/PrintHub/releases).

```bash
pnpm install
pnpm dev:desktop    # build & launch PrintHub.app (macOS)
pnpm dist:desktop   # build macOS .dmg (arm64)
```

Tray menu: Bridge / TCP / LAN status, copy LAN URL, HTTP port, restart Bridge, quit.

### Web demo (GitHub Pages)

The UI is deployed to GitHub Pages on every push to `main` — useful for exploring layout, themes, and **offline** debug preview (File / Hex / Base64). TCP print, printer simulation, and LAN features require a local Bridge or the desktop app.

**Live demo:** https://jackieleee.github.io/PrintHub/

### Printer simulation

In **Debug print**, the right panel simulates printer behavior for integration testing:

| Scenario | Behavior |
|----------|----------|
| **Normal** | Standard DLE EOT status responses |
| **Paper out** | Paper-out status bits on polls |
| **Cover open** | Cover-open status bit |
| **Offline** | Zero status bytes |
| **Slow** | Configurable status response delay |
| **Reject job** | Drops incoming TCP print jobs |

- **Traffic-light indicators** — green / yellow / red for scenario and cash-drawer state
- **Cash drawer** — compact pull-out UI; manual open/close; `ESC p` kicks from print jobs are detected and logged
- **Sim events** — WebSocket `sim.event` stream; newest first, deduplicated

**Sim HTTP API** (Bridge must be running):

```bash
# Read / update sim config
curl http://localhost:8081/sim/config
curl -X POST http://localhost:8081/sim/config \
  -H "Content-Type: application/json" \
  -d '{"scenario":"paper-out"}'

# Manual cash-drawer kick (UI uses this too)
curl -X POST http://localhost:8081/sim/drawer/kick \
  -H "Content-Type: application/json" \
  -d '{"pin":0}'
```

## Usage

**Requirements:** Node.js 20+, pnpm 9+

```bash
pnpm install
pnpm dev      # build Web UI + start Bridge
pnpm build:web   # production Web UI (shared + tspl + web; used by CI / GitHub Pages)
# or: pnpm start   (build + run, no watch)
```

1. Open **http://localhost:8081** (or your machine’s LAN IP).
2. Point the POS / app at **`<host>:9100`**.
3. In the UI, expand **Debug print** — try samples, raw submit, command reference, or printer simulation.
4. Debug preview works **without Bridge**; TCP scenarios and sim config require Bridge on `:8081`.

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

- `apps/desktop` — Electron desktop app (integrated Bridge, tray, optional LAN HTTP)
- `apps/web` — React dashboard
- `packages/bridge` — TCP listener, HTTP API, WebSocket relay, printer sim, mDNS, static UI
- `packages/escpos`, `packages/tspl`, `packages/renderer` — parse and render (ESC/POS inspector parser, TSPL label meta, Code128/QR canvas drawing)
- `packages/shared`, `packages/relay-client` — types and WS client

**CLI mode:** `pnpm dev` / `pnpm start` builds and serves `apps/web/dist` on port **8081** in one Bridge process.

**Desktop mode:** Bridge runs in the Electron main process; the UI uses IPC. Optional LAN HTTP serves the same web UI to other devices.

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
