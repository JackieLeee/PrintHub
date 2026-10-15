#!/usr/bin/env node
import { VirtPrinterBridge } from "./bridge.js";

const tcpPort = Number(process.env.VPH_TCP_PORT ?? 9100);
const httpPort = Number(process.env.VPH_HTTP_PORT ?? 8081);

const bridge = new VirtPrinterBridge({ tcpPort, httpPort, host: process.env.VPH_HOST, advertiseMdns: process.env.VPH_MDNS !== "0" });

bridge.start().catch((err) => {
  console.error("[bridge] failed to start:", err);
  process.exit(1);
});

const shutdown = () => {
  bridge.stop().then(() => process.exit(0));
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
