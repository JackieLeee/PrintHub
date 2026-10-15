import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, writeFile, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import { createServer } from "node:http";
import { WebSocketServer } from "ws";
import sharp from "sharp";
import { VirtPrinterBridge } from "./bridge.js";
import { startHttpServer } from "./http-server.js";
import { JobCapture } from "./control-client.js";

const cli = new URL("../dist/control-cli.js", import.meta.url);
function run(args: string[], signal?: NodeJS.Signals) {
  return new Promise<{ code: number | null; data: any; stderr: string }>((resolve, reject) => {
    const child = spawn(process.execPath, [cli.pathname, ...args], { stdio: ["ignore", "pipe", "pipe"] });
    let output = "", stderr = "";
    child.stdout.on("data", (chunk) => output += chunk);
    child.stderr.on("data", (chunk) => stderr += chunk);
    child.on("error", reject);
    const timer = signal ? setTimeout(() => child.kill(signal), 400) : undefined;
    child.on("close", (code) => {
      if (timer) clearTimeout(timer);
      try { resolve({ code, data: JSON.parse(output), stderr }); } catch { reject(new Error(`Invalid stdout: ${output}; ${stderr}`)); }
    });
  });
}

test("control CLI integrates actual HTTP service and job broadcaster on ephemeral loopback", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "printhub-cli-"));
  await writeFile(join(dir, "index.html"), "<!doctype html><title>Test SPA</title>");
  const bridge = new VirtPrinterBridge({ host: "127.0.0.1", advertiseMdns: false });
  const server = startHttpServer({ host: "127.0.0.1", port: 0, bridge, webRoot: dir });
  await once(server, "listening");
  const wss = new WebSocketServer({ server });
  wss.on("connection", (ws) => ws.send(JSON.stringify({ type: "hub.status", status: bridge.getPublicStatus() })));
  const unsubscribe = bridge.subscribe((message) => { for (const ws of wss.clients) ws.send(JSON.stringify(message)); });
  const url = `http://127.0.0.1:${(server.address() as any).port}`;
  const call = (...args: string[]) => run([...args, "--url", url, "--timeout-ms", "3000", "--request-id", "test-correlation"]);
  t.after(async () => { unsubscribe(); for (const ws of wss.clients) ws.terminate(); wss.close(); server.closeAllConnections(); await new Promise<void>((resolve) => server.close(() => resolve())); await rm(dir, { recursive: true, force: true }); });
  await t.test("health/status and schema envelopes with static UI enabled", async () => {
    assert.match(await (await fetch(url)).text(), /Test SPA/);
    assert.equal(((await (await fetch(`${url}/sim/config`)).json()) as { scenario: string }).scenario, "normal");
    for (const command of ["health", "status", "schema"]) {
      const res = await call(command); assert.equal(res.code, 0); assert.equal(res.data.schemaVersion, 1); assert.equal(res.data.requestId, "test-correlation"); assert.equal(res.stderr, "");
    }
  });
  await t.test("strict arguments prevent network mutation", async () => {
    for (const args of [["nonsense"], ["status", "--file", "x"], ["status", "--timeout-ms", "NaN"], ["config-set", "--args", '{"scenario":"invalid"}'], ["config-set", "--args", '{"logEvents":"false"}'], ["config-set", "--args", '{"printDelayMs":-1}'], ["config-set", "--args", '{"unknown":true}']]) {
      const res = await call(...args); assert.equal(res.code, 2, JSON.stringify(res));
    }
  });
  await t.test("backup is exclusive and restore CAS protects intervening writers and process identity", async () => {
    const file = join(dir, "backup.json");
    const backup = await call("config-backup", "--file", file); assert.equal(backup.code, 0);
    assert.notEqual((await call("config-backup", "--file", file)).code, 0);
    const set = await call("config-set", "--args", '{"scenario":"paper-out"}'); assert.equal(set.code, 0);
    const revision = set.data.result.revision;
    assert.equal((await call("config-restore", "--file", file, "--expected-revision", String(revision))).code, 0);
    const conflict = await call("config-restore", "--file", file, "--expected-revision", String(revision)); assert.equal(conflict.data.error.code, "CONFIG_CONFLICT");
    const current = (await call("config-get")).data.result;
    bridge.setPrinterSimConfig({ logEvents: false }); // Existing UI/service writer increments revision too.
    const uiConflict = await call("config-set", "--args", '{"scenario":"normal"}', "--expected-revision", String(current.revision), "--hub-instance-id", current.hubInstanceId);
    assert.equal(uiConflict.data.error.code, "CONFIG_CONFLICT");
    const content = JSON.parse(await readFile(file, "utf8")); content.hubInstanceId = "previous-process"; await writeFile(file, JSON.stringify(content));
    const restart = await call("config-restore", "--file", file, "--expected-revision", String(bridge.getConfigSnapshot().revision)); assert.equal(restart.data.error.code, "CONFIG_CONFLICT");
    await call("config-set", "--args", '{"scenario":"normal","logEvents":true}');
  });
  await t.test("raw print waits despite broadcast arriving before HTTP response; exact chunks and ID", async () => {
    for (const size of [64, 300_001]) {
      const payload = Buffer.alloc(size, 65); payload[size - 1] = 10;
      const path = join(dir, `raw-${size}`); await writeFile(path, payload);
      const result = await call("print-raw", "--file", path, "--wait");
      assert.equal(result.code, 0, JSON.stringify(result));
      assert.equal(result.data.result.jobId, result.data.result.job.id);
      assert.equal(result.data.result.hubInstanceId, bridge.hubInstanceId);
      assert.deepEqual(Buffer.from(result.data.result.payloadBase64, "base64"), payload);
    }
  });
  await t.test("jobs-wait observes a new matching job and print without wait acknowledges", async () => {
    const waiting = call("jobs-wait");
    const interval = setInterval(() => {
      if (wss.clients.size > 0) { clearInterval(interval); bridge.ingestRaw(Buffer.from("observed\n"), "127.0.0.1"); }
    }, 10);
    try {
      const observed = await waiting; assert.equal(observed.code, 0, JSON.stringify(observed));
      assert.equal(Buffer.from(observed.data.result.payloadBase64, "base64").toString(), "observed\n");
    } finally { clearInterval(interval); }
    const accepted = await call("print-raw", "--file", join(dir, "raw-64"));
    assert.equal(accepted.code, 0); assert.ok(accepted.data.result.jobId);
  });
  await t.test("simulation rejection is surfaced without retry", async () => {
    await call("config-set", "--args", '{"scenario":"reject-job"}');
    const result = await call("print-raw", "--file", join(dir, "raw-64"), "--wait"); assert.equal(result.code, 1); assert.equal(result.data.error.code, "HTTP_ERROR");
    await call("config-set", "--args", '{"scenario":"normal"}');
  });
  await t.test("image ingest uses existing converter and returns captured bytes", async () => {
    const path = join(dir, "image.png"); await sharp({ create: { width: 2, height: 2, channels: 3, background: "black" } }).png().toFile(path);
    const result = await call("print-image", "--file", path, "--wait"); assert.equal(result.code, 0, JSON.stringify(result)); assert.ok(result.data.result.payloadBase64.length > 0);
  });
  await t.test("wait deadline and process cancellation terminate cleanly", async () => {
    const timeout = await run(["jobs-wait", "--url", url, "--timeout-ms", "80"]); assert.equal(timeout.code, 1); assert.equal(timeout.data.error.code, "TIMEOUT");
    const signal = await run(["jobs-wait", "--url", url, "--timeout-ms", "5000"], "SIGINT"); assert.equal(signal.code, 130);
  });
  await t.test("accepted print without observed completion is unknown and retains job ID", async () => {
    unsubscribe();
    const result = await run(["print-raw", "--file", join(dir, "raw-64"), "--wait", "--url", url, "--timeout-ms", "600"]);
    assert.equal(result.code, 3); assert.equal(result.data.error.code, "RESULT_UNKNOWN");
    assert.ok(result.data.error.jobId);
  });
});

test("lost POST response is unknown and submitted exactly once", async (t) => {
  let count = 0;
  const server = createServer((req) => { if (req.method === "POST") count++; req.resume(); req.on("end", () => req.socket.destroy()); });
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  const dir = await mkdtemp(join(tmpdir(), "printhub-lost-")); const file = join(dir, "receipt"); await writeFile(file, "test\n");
  t.after(async () => { server.close(); await rm(dir, { recursive: true, force: true }); });
  const result = await run(["print-raw", "--file", file, "--url", `http://127.0.0.1:${(server.address() as any).port}`]);
  assert.equal(result.code, 3); assert.equal(result.data.error.code, "RESULT_UNKNOWN"); assert.equal(count, 1);
});

test("malformed chunk streams fail closed", async (t) => {
  for (const kind of ["missing", "duplicate", "length", "oversize"]) await t.test(kind, async () => {
    const server = createServer(); const wss = new WebSocketServer({ server });
    server.listen(0, "127.0.0.1"); await once(server, "listening");
    wss.on("connection", (ws) => {
      ws.send(JSON.stringify({ type: "hub.status", status: { hubInstanceId: "test" } }));
      const job = { id: "one", byteLength: kind === "oversize" ? 30 * 1024 * 1024 : 4 };
      ws.send(JSON.stringify({ type: "job.start", job, chunkCount: 2, chunkSize: 2 }));
      ws.send(JSON.stringify({ type: "job.chunk", id: "one", index: 0, dataBase64: Buffer.from(kind === "length" ? "abc" : "ab").toString("base64") }));
      if (kind === "duplicate") ws.send(JSON.stringify({ type: "job.chunk", id: "one", index: 0, dataBase64: "YWI=" }));
      ws.send(JSON.stringify({ type: "job.end", id: "one" }));
    });
    const capture = new JobCapture(new URL(`ws://127.0.0.1:${(server.address() as any).port}`), AbortSignal.timeout(1000), "test");
    try { await capture.ready; await assert.rejects(capture.wait(), /chunk|metadata/i); }
    finally { capture.close(); for (const ws of wss.clients) ws.terminate(); wss.close(); server.close(); }
  });
});

test("malformed mutation acknowledgements and oversized HTTP replies fail safely", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "printhub-ack-")); const file = join(dir, "receipt"); await writeFile(file, "test\n");
  t.after(() => rm(dir, { recursive: true, force: true }));
  for (const reply of ["{}", '{"ok":false}', '"unexpected"', "x".repeat(1024 * 1024 + 1)]) await t.test(`reply bytes ${reply.length}`, async () => {
    let count = 0;
    const server = createServer((req, res) => { count++; req.resume(); req.on("end", () => { res.writeHead(200); res.end(reply); }); });
    server.listen(0, "127.0.0.1"); await once(server, "listening");
    try {
      const result = await run(["print-raw", "--file", file, "--url", `http://127.0.0.1:${(server.address() as any).port}`]);
      assert.equal(result.code, 3); assert.equal(result.data.error.code, "RESULT_UNKNOWN"); assert.equal(count, 1);
    } finally { server.closeAllConnections(); server.close(); }
  });
});
