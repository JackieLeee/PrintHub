# virt-printer-hub

> **English:** [README.md](./README.md)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-20%2B-green?logo=node.js&logoColor=white)](https://nodejs.org/)
[![pnpm](https://img.shields.io/badge/pnpm-9%2B-F69220?logo=pnpm&logoColor=white)](https://pnpm.io/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![GitHub Pages](https://github.com/JackieLeee/virt-printer-hub/actions/workflows/deploy-pages.yml/badge.svg)](https://github.com/JackieLeee/virt-printer-hub/actions/workflows/deploy-pages.yml)
[![Live Demo](https://img.shields.io/badge/demo-GitHub%20Pages-blue)](https://jackieleee.github.io/virt-printer-hub/)

## 背景

收银机、POS 和标签机通常通过 TCP 发送 **原始 ESC/POS 或 TSPL 字节流**，而不是 PDF。没有实体打印机时，很难确认发出的数据是否正确。

**virt-printer-hub** 是一个 **局域网虚拟打印机**：接收与真实设备相同的数据，在浏览器中实时预览、查看历史，并支持 Sample 与 Raw 调试打印。

## 功能

| 能力 | 说明 |
|------|------|
| **接收** | TCP **9100** 接收 ESC/POS 小票与 TSPL 标签 |
| **预览** | 小票/标签渲染（对齐 [EscPosInspector](https://github.com/amin-norollah/EscPosInspector)） |
| **历史** | 浏览器本地保存最近任务，支持回放与导出（File / Hex / Base64） |
| **调试** | 一键 ESC/POS & TSPL Sample；File / Hex / Base64 原始提交 |

| 端口 | 用途 |
|------|------|
| **9100** | TCP — POS 或测试工具发送打印数据 |
| **8081** | HTTP + WebSocket + 内嵌 Web 控制台 |

## 使用方法

**环境：** Node.js 20+、pnpm 9+

```bash
pnpm install
pnpm dev      # 构建 Web UI 并启动 Bridge
# 或：pnpm start  （构建后运行，无 watch）
```

1. 打开 **http://localhost:8081**（或本机局域网 IP）。
2. 将 POS / 应用指向 **`<主机>:9100`**。
3. 在界面点击 **Print ESC/POS Sample** 或 **Print TSPL Sample** 验证。

**TCP 快速测试：**

```bash
printf '\x1b@\x1ba\x01Hello virt-printer-hub\n\x1dV\x00' | nc -N localhost 9100
```

**HTTP Raw 提交：**

```bash
curl -X POST http://localhost:8081/print/raw \
  -H "Content-Type: application/octet-stream" \
  --data-binary @sample.bin
```

## 架构

![virt-printer-hub 架构图](./docs/assets/architecture.zh.png)

**Monorepo 结构**

- `packages/bridge` — TCP 监听、HTTP API、WebSocket、静态 UI
- `packages/web` — React 控制台
- `packages/escpos`、`packages/tspl`、`packages/renderer` — 解析与渲染
- `packages/shared`、`packages/relay-client` — 类型与 WS 客户端

一条命令（`pnpm dev` / `pnpm start`）即可：Bridge 构建并托管 `apps/web/dist`，统一在 **8081** 端口访问。

## Star 趋势

<a href="https://www.star-history.com/?repos=JackieLeee%2Fvirt-printer-hub&type=date&legend=top-left">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=JackieLeee/virt-printer-hub&type=date&theme=dark&legend=top-left&sealed_token=5vTp2kN2Rk2htmjqKbdcYEzHPHACTGKRblEW08e-5wqCuPr41LtoqOmJjIRJWfwjhDOprVY9FCwJSrD3KFNnznqcqLtkPY4FcAEWgeVJGupONbZI4QBR3VJElwzD5JdlgGcFmKlLNvPtdBXMKYLbVHVHpQtnw1YwEui_In1eWmz4kVFyzrUUYw4sN8dm" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=JackieLeee/virt-printer-hub&type=date&legend=top-left&sealed_token=5vTp2kN2Rk2htmjqKbdcYEzHPHACTGKRblEW08e-5wqCuPr41LtoqOmJjIRJWfwjhDOprVY9FCwJSrD3KFNnznqcqLtkPY4FcAEWgeVJGupONbZI4QBR3VJElwzD5JdlgGcFmKlLNvPtdBXMKYLbVHVHpQtnw1YwEui_In1eWmz4kVFyzrUUYw4sN8dm" />
   <img alt="Star History Chart" src="https://api.star-history.com/chart?repos=JackieLeee/virt-printer-hub&type=date&legend=top-left&sealed_token=5vTp2kN2Rk2htmjqKbdcYEzHPHACTGKRblEW08e-5wqCuPr41LtoqOmJjIRJWfwjhDOprVY9FCwJSrD3KFNnznqcqLtkPY4FcAEWgeVJGupONbZI4QBR3VJElwzD5JdlgGcFmKlLNvPtdBXMKYLbVHVHpQtnw1YwEui_In1eWmz4kVFyzrUUYw4sN8dm" />
 </picture>
</a>

---

MIT License — 见 [LICENSE](./LICENSE)。  
参与贡献：[CONTRIBUTING.md](./CONTRIBUTING.md) · 安全：[SECURITY.md](./SECURITY.md)
