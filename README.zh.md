# PrintHub

> **English:** [README.md](./README.md)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Release](https://img.shields.io/github/v/release/JackieLeee/PrintHub?label=release)](https://github.com/JackieLeee/PrintHub/releases)
[![Node.js](https://img.shields.io/badge/Node.js-20%2B-green?logo=node.js&logoColor=white)](https://nodejs.org/)
[![pnpm](https://img.shields.io/badge/pnpm-9%2B-F69220?logo=pnpm&logoColor=white)](https://pnpm.io/)

局域网 **虚拟打印机**，接收 **ESC/POS** 小票与 **TSPL** 标签原始字节流 — 浏览器实时预览、历史回放与调试，无需实体打印机。

**v1.1.0 新增：** Inspector 与预览联动 · PNG/PDF 导出 · `@virt-printer/analyze` Agent API · Star 方言检测 · 命令手册与 fixtures 回归库。

## 功能

| | |
|---|---|
| **检查器** | 指令块分组（Setup / Preview / 复合），点击高亮预览区域 |
| **导出** | PNG / PDF（标签物理尺寸）、Hex / Base64 / 指令 / 原始文件 |
| **Analyze** | `printhub-analyze` CLI — JSON 结构化输出，供 Agent 与 CI 使用 |
| **预览** | ESC/POS & TSPL Canvas；Star 方言徽章；最近 **50** 条任务 |
| **调试** | Sample + File / Hex / Base64 — **可离线**，无需 Bridge |
| **工作台** | 虚拟打印机 · 网络与端口 · 调试打印 · 打印机模拟 · 命令手册 |
| **桌面端** | Electron 集成 Bridge、托盘、中/EN、可选局域网 HTTP |
| **发现** | mDNS `_pdl-datastream._tcp` · 端口 **9100** |

**端口：** TCP **9100**（打印，始终开启）· HTTP **8081**（Web 控制台；CLI 常开，桌面端可选）

## 下载

[Releases](https://github.com/JackieLeee/PrintHub/releases) · [在线演示](https://jackieleee.github.io/PrintHub/)（仅 UI，无 TCP）

| 平台 | 文件 |
|------|------|
| macOS（Apple 芯片） | `*-arm64.dmg` ~110 MB |
| macOS（Intel） | `*-x64.dmg` ~110 MB |
| Windows x64 | `PrintHub Setup *.exe` ~99 MB |

> **未签名。** macOS：**右键 → 打开**。Windows：**更多信息 → 仍要运行**。

## 快速开始

**Node.js 20+ · pnpm 9+**

```bash
pnpm install
pnpm dev          # CLI：Web 控制台 + Bridge :8081
pnpm dev:desktop  # Electron 桌面端
```

1. 打开 **http://localhost:8081**（局域网：`http://<主机IP>:8081`）
2. POS 指向 **`<主机IP>:9100`**

```bash
# TCP 快速测试
printf '\x1b@\x1ba\x01Hello PrintHub\n\x1dV\x00' | nc -N localhost 9100
```

**打包：** `pnpm dist:desktop`（macOS）· `pnpm dist:desktop:win`（Windows）

| 工作台 | 预览与历史 | 调试打印 |
|:---:|:---:|:---:|
| ![工作台](./docs/assets/desktop-workbench.png) | ![预览](./docs/assets/desktop-preview-history.png) | ![调试](./docs/assets/desktop-debug-tspl.png) |

## 架构

![架构图](./docs/assets/architecture.zh.png)

`apps/desktop` · `apps/web` · `packages/bridge` · `packages/{escpos,tspl,renderer,analyze,fixtures}` · `packages/{shared,relay-client}`

**Analyze（CLI）：** `pnpm exec printhub-analyze path/to/job.bin`

---

MIT · [CONTRIBUTING](./CONTRIBUTING.md) · [SECURITY](./SECURITY.md)

<a href="https://www.star-history.com/?repos=JackieLeee%2FPrintHub&type=date&legend=bottom-right">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=JackieLeee/PrintHub&type=date&theme=dark&legend=bottom-right&sealed_token=nZ7TJ03ductF3SiTo2_x9Ry8wmdRlWLIKmXdxoqRfHGkvFTL1NlWxsoL_mwD-dvCVfMZyzyZBzIM8Ihzq8OU20MkofoZvSxuyMsDOOtdZ4QVigSvLemN2CREu9Vshu8wZoD0fdcGEmLEiHpFYXfkdgGvjq8Zi8n1CIzMHumwS2FRSd_6JyewdE8DLc-K" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=JackieLeee/PrintHub&type=date&legend=bottom-right&sealed_token=nZ7TJ03ductF3SiTo2_x9Ry8wmdRlWLIKmXdxoqRfHGkvFTL1NlWxsoL_mwD-dvCVfMZyzyZBzIM8Ihzq8OU20MkofoZvSxuyMsDOOtdZ4QVigSvLemN2CREu9Vshu8wZoD0fdcGEmLEiHpFYXfkdgGvjq8Zi8n1CIzMHumwS2FRSd_6JyewdE8DLc-K" />
   <img alt="Star 趋势" src="https://api.star-history.com/chart?repos=JackieLeee/PrintHub&type=date&legend=bottom-right&sealed_token=nZ7TJ03ductF3SiTo2_x9Ry8wmdRlWLIKmXdxoqRfHGkvFTL1NlWxsoL_mwD-dvCVfMZyzyZBzIM8Ihzq8OU20MkofoZvSxuyMsDOOtdZ4QVigSvLemN2CREu9Vshu8wZoD0fdcGEmLEiHpFYXfkdgGvjq8Zi8n1CIzMHumwS2FRSd_6JyewdE8DLc-K" />
 </picture>
</a>
