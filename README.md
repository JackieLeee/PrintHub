# virt-printer-hub

网页端虚拟打印机：完整 ESC/POS + TSPL 协议支持、图片打印、多设备并发、小票可视化预览。

## 架构

- **Web UI**（`apps/web`）— 部署到 GitHub Pages，展示打印历史与预览
- **Local Bridge**（`packages/bridge`）— TCP 9100、WebSocket 8080、HTTP 8081
- **协议包** — `@virt-printer/escpos`、`@virt-printer/tspl`、`@virt-printer/renderer`

## 功能（Phase 2–4）

### Bridge（Phase 4–5）
- TCP 保活 + 120s 空闲超时 · WebSocket 30s ping
- 大 payload 分块（>256KB）· HTTP 8081 图片上传
- **mDNS** 广播 `_virt-printer._tcp`（Bonjour）

### Web（Phase 5）
- 局域网扫描发现 Hub（`/status` 探测）
- 多 Hub 切换 · 最近 Hub 记忆（localStorage）
- IndexedDB 按 Hub 隔离历史 · 批量写入防抖

### ESC/POS
- 文本样式（加粗/下划线/倍宽倍高）、对齐、走纸、切纸、钱箱
- 条码 `GS k`、二维码 `GS ( k`、光栅图 `GS v 0` / `ESC *`
- GBK / UTF-8 编码

### TSPL
- 标签设置：`SIZE` / `GAP` / `DIRECTION` / `REFERENCE` / `OFFSET` / `CLS`
- 文本：`TEXT` / `BLOCK`（换行、旋转）
- 图形：`BOX` / `BAR` / `CIRCLE` / `ELLIPSE` / `REVERSE`
- 条码 / 二维码：`BARCODE` / `QRCODE`
- 位图：`BITMAP` 行内十六进制 + 尾随二进制

### 通用
- Canvas 标签/小票预览
- IndexedDB 最近 200 条历史

## 快速开始

```bash
pnpm install

# 终端 1：启动 Bridge（TCP 9100 + WS 8080 + HTTP 8081）
pnpm dev:bridge

# 终端 2：启动 Web UI
pnpm dev:web
```

浏览器打开 http://localhost:5173 ，POS 或测试工具向 `本机IP:9100` 发送打印数据。

### 测试 ESC/POS

```bash
printf '\x1b@\x1ba\x01Hello virt-printer-hub\n\x1dV\x00' | nc -N localhost 9100
```

### 测试 TSPL

```bash
printf 'SIZE 40 mm,30 mm\nGAP 2 mm,0\nTEXT 10,10,"0",0,1,1,"TSPL Label"\nPRINT 1\n' | nc localhost 9100
```

### 测试图片打印（HTTP）

```bash
curl -X POST "http://localhost:8081/print/image?protocol=escpos&width=384" \
  -H "Content-Type: image/png" \
  --data-binary @receipt.png
```

## GitHub Pages

推送到 `main` 分支后，GitHub Actions 自动构建并部署。Bridge 仍需在本地或局域网机器运行。

部署 URL：`https://<user>.github.io/virt-printer-hub/`

本地开发时 Web UI 默认连接 `ws://localhost:8080`；生产环境可通过 URL 参数指定 Bridge 地址，例如：

`https://<user>.github.io/virt-printer-hub/?ws=ws://192.168.1.42:8080`

## 包说明

| 包 | 说明 |
|---|---|
| `@virt-printer/shared` | 共享类型与常量 |
| `@virt-printer/escpos` | ESC/POS 解析 |
| `@virt-printer/tspl` | TSPL 解析 |
| `@virt-printer/renderer` | Canvas 小票/标签渲染 |
| `@virt-printer/relay-client` | WebSocket 客户端 |
| `@virt-printer/bridge` | Node.js TCP + WS 服务 |

## License

MIT
