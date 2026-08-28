# PrintHub

> **English:** [README.md](./README.md)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Release](https://img.shields.io/github/v/release/JackieLeee/PrintHub?label=release)](https://github.com/JackieLeee/PrintHub/releases)
[![Node.js](https://img.shields.io/badge/Node.js-20%2B-green?logo=node.js&logoColor=white)](https://nodejs.org/)
[![pnpm](https://img.shields.io/badge/pnpm-9%2B-F69220?logo=pnpm&logoColor=white)](https://pnpm.io/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)

## 背景

收银机、POS 和标签机通常通过 TCP 发送 **原始 ESC/POS 或 TSPL 字节流**，而不是 PDF。没有实体打印机时，很难确认发出的数据是否正确。

**PrintHub** 是一个 **局域网虚拟打印机**：接收与真实设备相同的数据，在浏览器中实时预览、查看历史，并支持 Sample 与 Raw 调试打印。

## 功能

| 能力 | 说明 |
|------|------|
| **接收** | TCP **9100** 接收 ESC/POS 小票与 TSPL 标签 |
| **预览** | Canvas 小票/标签预览（ESC/POS + TSPL） |
| **历史** | 浏览器本地保存最近 **50** 条任务，支持回放与导出 |
| **调试** | ESC/POS & TSPL Sample；File / Hex / Base64 提交 — **可离线**，无需 Bridge |
| **工作台** | 虚拟打印机 + **网络与端口** / **调试打印** Tab |
| **主题与语言** | 10 套 UI 主题；**中文 / English**；桌面端持久化（`settings.json`） |
| **打印机模拟** | 场景模拟、DLE EOT 状态、钱箱脉冲、事件日志 |
| **桌面应用** | Electron 集成 Bridge、菜单栏托盘、可选局域网 HTTP |
| **mDNS** | 广播 `_pdl-datastream._tcp` · 端口 **9100** |

| 端口 | 用途 |
|------|------|
| **9100** | TCP — 打印数据（始终开启） |
| **8081** | HTTP + WebSocket + Web 控制台（桌面端默认关闭；CLI 始终开启） |

### 桌面应用（macOS）

Bridge 内置于 Electron。TCP **9100** 始终可用；局域网 HTTP **默认关闭**，可在托盘中开启。

安装包见 [Releases](https://github.com/JackieLeee/PrintHub/releases)（**macOS universal** `.dmg`，Apple 芯片 + Intel 通用）。

```bash
pnpm install
pnpm dev:desktop    # 构建并启动 PrintHub.app
pnpm dist:desktop   # 打包 macOS universal .dmg
```

> **未签名说明：** 发布版 **未做 Apple 代码签名**（无 Developer ID）。首次打开时 macOS 可能拦截。请 **右键 PrintHub → 打开**，或在 **系统设置 → 隐私与安全性** 中允许运行。开源项目未购买签名证书时属于正常现象。

托盘菜单：状态（Bridge / TCP / mDNS / 局域网）、复制局域网地址、HTTP 端口、**语言**（EN / 中文）、重启 Bridge、退出。主题与语言在 Web 控制台与托盘间双向同步（`settings.json` + localStorage）。

**macOS** 托盘行使用 label 前缀 — 状态 **🟢 / 🟡 / 🔴**，**🌐** 表示语言 — 因 Electron 托盘菜单不渲染自定义图标。Windows/Linux 使用 SVG 菜单图标。

| 工作台 | 预览与历史 | 调试打印 |
|:---:|:---:|:---:|
| ![工作台](./docs/assets/desktop-workbench.png) | ![预览与历史](./docs/assets/desktop-preview-history.png) | ![调试打印 TSPL](./docs/assets/desktop-debug-tspl.png) |

### Web 演示（GitHub Pages）

仅 UI 演示 — 可浏览主题与 **离线** 调试预览。TCP 打印与模拟需本地 Bridge 或桌面应用。

**在线演示：** https://jackieleee.github.io/PrintHub/

### 打印机模拟

| 场景 | 行为 |
|------|----------|
| **正常** | 标准 DLE EOT 响应 |
| **缺纸** | 缺纸状态位；TCP 保持连接 |
| **开盖** | 开盖状态位；TCP 保持连接 |
| **离线** | 拒绝新 TCP 连接 |
| **慢响应** | 可配置状态延迟 |
| **拒打** | 丢弃传入打印任务 |

```bash
curl http://localhost:8081/sim/config
curl -X POST http://localhost:8081/sim/config \
  -H "Content-Type: application/json" -d '{"scenario":"paper-out"}'
curl -X POST http://localhost:8081/sim/events/clear
```

## 使用方法

**环境：** Node.js 20+、pnpm 9+

```bash
pnpm install
pnpm dev          # 构建 Web UI 并启动 Bridge
pnpm build:web    # 生产环境 Web UI（CI / GitHub Pages）
```

1. 打开 **http://localhost:8081**（或本机局域网 IP）。
2. 将 POS / 应用指向 **`<主机IP>:9100`**。
3. 在 **工作台** 中查看网络信息、调试打印与模拟场景。

> **局域网访问：** 同网段设备请用 `http://<Bridge机器IP>:8081`，不要用 `localhost`。

**TCP 快速测试：**

```bash
printf '\x1b@\x1ba\x01Hello PrintHub\n\x1dV\x00' | nc -N localhost 9100
```

**HTTP Raw 提交：**

```bash
curl -X POST http://localhost:8081/print/raw \
  -H "Content-Type: application/octet-stream" \
  --data-binary @sample.bin
```

## 架构

![PrintHub 架构图](./docs/assets/architecture.zh.png)

- `apps/desktop` — Electron（Bridge、托盘、可选局域网 HTTP）
- `apps/web` — React 控制台
- `packages/bridge` — TCP、HTTP API、WebSocket、模拟、mDNS
- `packages/escpos`、`packages/tspl`、`packages/renderer` — 解析与渲染
- `packages/shared`、`packages/relay-client` — 类型与 WS 客户端

**CLI：** `pnpm dev` 在 **8081** 托管 `apps/web/dist`。**桌面：** Bridge 在 Electron 主进程；UI 通过 IPC 通信。

## Star 趋势

<a href="https://www.star-history.com/?repos=JackieLeee%2FPrintHub&type=date&legend=bottom-right">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=JackieLeee/PrintHub&type=date&theme=dark&legend=bottom-right&sealed_token=nZ7TJ03ductF3SiTo2_x9Ry8wmdRlWLIKmXdxoqRfHGkvFTL1NlWxsoL_mwD-dvCVfMZyzyZBzIM8Ihzq8OU20MkofoZvSxuyMsDOOtdZ4QVigSvLemN2CREu9Vshu8wZoD0fdcGEmLEiHpFYXfkdgGvjq8Zi8n1CIzMHumwS2FRSd_6JyewdE8DLc-K" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=JackieLeee/PrintHub&type=date&legend=bottom-right&sealed_token=nZ7TJ03ductF3SiTo2_x9Ry8wmdRlWLIKmXdxoqRfHGkvFTL1NlWxsoL_mwD-dvCVfMZyzyZBzIM8Ihzq8OU20MkofoZvSxuyMsDOOtdZ4QVigSvLemN2CREu9Vshu8wZoD0fdcGEmLEiHpFYXfkdgGvjq8Zi8n1CIzMHumwS2FRSd_6JyewdE8DLc-K" />
   <img alt="Star History Chart" src="https://api.star-history.com/chart?repos=JackieLeee/PrintHub&type=date&legend=bottom-right&sealed_token=nZ7TJ03ductF3SiTo2_x9Ry8wmdRlWLIKmXdxoqRfHGkvFTL1NlWxsoL_mwD-dvCVfMZyzyZBzIM8Ihzq8OU20MkofoZvSxuyMsDOOtdZ4QVigSvLemN2CREu9Vshu8wZoD0fdcGEmLEiHpFYXfkdgGvjq8Zi8n1CIzMHumwS2FRSd_6JyewdE8DLc-K" />
 </picture>
</a>

---

MIT License — 见 [LICENSE](./LICENSE)。  
参与贡献：[CONTRIBUTING.md](./CONTRIBUTING.md) · 安全：[SECURITY.md](./SECURITY.md)
