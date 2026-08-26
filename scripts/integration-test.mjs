#!/usr/bin/env node
/**
 * Local integration smoke tests for virt-printer-hub Bridge.
 * Usage: node scripts/integration-test.mjs
 */
import net from "node:net";

const HTTP = "http://127.0.0.1:8081";
const WS = "ws://127.0.0.1:8080";
const TCP = { host: "127.0.0.1", port: 9100 };

let passed = 0;
let failed = 0;

function ok(name) {
  passed++;
  console.log(`  ✓ ${name}`);
}

function fail(name, err) {
  failed++;
  console.error(`  ✗ ${name}:`, err instanceof Error ? err.message : err);
}

async function fetchJson(url, init) {
  const res = await fetch(url, init);
  const body = await res.json();
  if (!res.ok) throw new Error(`${res.status} ${JSON.stringify(body)}`);
  return body;
}

function sendTcp(payload) {
  return new Promise((resolve, reject) => {
    const sock = net.createConnection(TCP.port, TCP.host);
    sock.on("error", reject);
    sock.on("close", resolve);
    sock.write(payload);
    sock.end();
  });
}

function waitForJob(ws, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("job timeout")), timeoutMs);
    ws.addEventListener("message", (event) => {
      const msg = JSON.parse(event.data.toString());
      if (msg.type === "job.complete") {
        clearTimeout(timer);
        resolve(msg);
      }
    });
  });
}

async function testHealth() {
  const health = await fetchJson(`${HTTP}/health`);
  if (!health.ok) throw new Error("health not ok");
  ok("GET /health");
}

async function testStatus() {
  const status = await fetchJson(`${HTTP}/status`);
  if (!status.hubInstanceId) throw new Error("missing hubInstanceId");
  if (!status.listening) throw new Error("not listening");
  ok(`GET /status (instance ${status.hubInstanceId.slice(0, 8)}…)`);
  return status;
}

async function testWsEscpos() {
  const ws = new WebSocket(WS);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", () => reject(new Error("ws open failed")), { once: true });
  });
  const escpos = Buffer.from([0x1b, 0x40, ...Buffer.from("Integration ESC/POS\n"), 0x0a]);
  const jobPromise = waitForJob(ws);
  await sendTcp(escpos);
  const msg = await jobPromise;
  if (msg.job.protocol !== "escpos") throw new Error(`expected escpos, got ${msg.job.protocol}`);
  ws.close();
  ok("TCP ESC/POS → WebSocket job.complete");
}

async function testWsTspl() {
  const ws = new WebSocket(WS);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", () => reject(new Error("ws open failed")), { once: true });
  });
  const tspl = Buffer.from(
    'SIZE 40 mm,30 mm\nCLS\nTEXT 20,20,"4",0,1,1,"Integration TSPL"\nPRINT 1\n',
    "utf8",
  );
  const jobPromise = waitForJob(ws);
  await sendTcp(tspl);
  const msg = await jobPromise;
  if (msg.job.protocol !== "tspl") throw new Error(`expected tspl, got ${msg.job.protocol}`);
  ws.close();
  ok("TCP TSPL → WebSocket job.complete");
}

async function testImageUpload() {
  // 1x1 red PNG
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  );
  const res = await fetchJson(`${HTTP}/print/image?protocol=escpos&width=384`, {
    method: "POST",
    headers: { "Content-Type": "image/png" },
    body: png,
  });
  if (!res.ok || !res.jobId) throw new Error("image upload failed");
  ok(`POST /print/image (${res.jobId})`);
}

async function main() {
  console.log("virt-printer-hub integration tests\n");
  const tests = [
    ["health", testHealth],
    ["status", testStatus],
    ["ws-escpos", testWsEscpos],
    ["ws-tspl", testWsTspl],
    ["image", testImageUpload],
  ];
  for (const [name, fn] of tests) {
    try {
      await fn();
    } catch (err) {
      fail(name, err);
    }
  }
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
