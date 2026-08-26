#!/usr/bin/env node
import { VirtPrinterBridge } from "./bridge.js";

const tcpPort = Number(process.env.VPH_TCP_PORT ?? 9100);
const wsPort = Number(process.env.VPH_WS_PORT ?? 8080);
const httpPort = Number(process.env.VPH_HTTP_PORT ?? 8081);

const bridge = new VirtPrinterBridge({ tcpPort, wsPort, httpPort });

bridge.start().catch((err) => {
  console.error("[bridge] failed to start:", err);
  process.exit(1);
});

process.on("SIGINT", () => {
  bridge.stop().then(() => process.exit(0));
});
