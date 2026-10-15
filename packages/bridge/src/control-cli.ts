#!/usr/bin/env node
import { parseArgs } from "node:util";
import { readFile, writeFile, stat } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { JobCapture, ControlError, MAX_PAYLOAD } from "./control-client.js";
import { scenarios, validateConfigPatch } from "./control-config.js";

const commands = ["health", "status", "config-get", "config-set", "config-backup", "config-restore", "print-raw", "print-image", "jobs-wait", "schema", "help"];
const help = `PrintHub control CLI (Node >= 20)\nUsage: printhub <command> [options]\nCommands: ${commands.join(", ")}\nGlobal: --url URL (http://127.0.0.1:8081), --timeout-ms N (10000; 1..300000), --request-id ID\nconfig-set: --args JSON patch [--expected-revision N --hub-instance-id ID]\nconfig-backup: --file NEW_FILE (exclusive create)\nconfig-restore: --file BACKUP --expected-revision N (from your last config-set)\nprint-raw: --file FILE [--wait]\nprint-image: --file FILE [--protocol escpos|tspl] [--width N] [--wait]\njobs-wait: [--job-id ID] (new events only; no history)\nOutput: one JSON envelope; no automatic retries. --help prints this text.\nExits: 0 success, 1 failure, 2 usage, 3 effect outcome unknown, 130 SIGINT, 143 SIGTERM.\n--wait confirms virtual capture, never physical printing. HTTP raw ingestion skips simulated timing; image ingestion also skips some faults. Use TCP for protocol/timing tests.\nThe CLI URL does not change the server's bind address or add authentication.\n`;
let requestId = randomUUID() as string;
let submitted = false;
let acceptedJobId: string | undefined;
let signalExit: number | undefined;
const controller = new AbortController();
for (const [signal, code] of [["SIGINT", 130], ["SIGTERM", 143]] as const) process.once(signal, () => { signalExit = code; controller.abort(); });
let timer: ReturnType<typeof setTimeout> | undefined;
let capture: JobCapture | undefined;
function usage(message: string): never { throw new ControlError("INVALID_ARGUMENT", message, 2); }
function integer(value: string | undefined, name: string, min: number, max: number) {
  if (value === undefined || !/^\d+$/.test(value)) return usage(`${name} must be an integer`);
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < min || n > max) return usage(`${name} must be ${min}..${max}`);
  return n;
}
async function main() {
  let parsed;
  try {
    parsed = parseArgs({ options: { wait: { type: "boolean" }, help: { type: "boolean" }, ...Object.fromEntries(["url", "timeout-ms", "request-id", "args", "file", "expected-revision", "hub-instance-id", "job-id", "protocol", "width"].map((name) => [name, { type: "string" as const }])) }, tokens: true, allowPositionals: true, strict: true, args: process.argv.slice(2) });
  } catch (err) { usage(err instanceof Error ? err.message : "Invalid arguments"); }
  const seen = new Set<string>();
  for (const token of parsed.tokens) if (token.kind === "option") {
    if (seen.has(token.name)) usage(`Duplicate option --${token.name}`);
    seen.add(token.name);
  }
  const options = parsed.values as Record<string, string | undefined>;
  const wait = parsed.values.wait === true;
  if (parsed.values.help === true || parsed.positionals[0] === "help") { process.stdout.write(help); return; }
  const command = parsed.positionals[0];
  if (options["request-id"]) requestId = options["request-id"]!;
  if (!command || !commands.includes(command) || parsed.positionals.length !== 1) usage("Specify one command; use --help");
  const allowed: Record<string, string[]> = {
    "config-set": ["args", "expected-revision", "hub-instance-id"], "config-backup": ["file"], "config-restore": ["file", "expected-revision"],
    "print-raw": ["file"], "print-image": ["file", "protocol", "width"], "jobs-wait": ["job-id"],
  };
  for (const key of Object.keys(options)) if (!["url", "timeout-ms", "request-id", "wait", "help", ...(allowed[command] ?? [])].includes(key)) usage(`--${key} is not valid for ${command}`);
  if (wait && !command.startsWith("print-")) usage("--wait is only valid for print commands");
  let base: URL;
  try { base = new URL(options.url ?? "http://127.0.0.1:8081"); } catch { return usage("invalid URL"); }
  if (!["http:", "https:"].includes(base.protocol) || base.username || base.password || base.search || base.hash || base.pathname !== "/") usage("URL must be an HTTP(S) origin without credentials, path, query or fragment");
  const timeout = integer(options["timeout-ms"] ?? "10000", "timeout-ms", 1, 300_000);
  timer = setTimeout(() => controller.abort(), timeout);
  async function api(path: string, body?: unknown, binary = false): Promise<any> {
    const effect = body !== undefined;
    let response: Response;
    try {
      if (effect) submitted = true;
      response = await fetch(new URL(path, base), { method: effect ? "POST" : "GET", redirect: "error", signal: controller.signal, headers: effect ? { "content-type": binary ? "application/octet-stream" : "application/json" } : {}, body: effect ? (binary ? body as any : JSON.stringify(body)) : undefined });
      const chunks: Uint8Array[] = [];
      let bytes = 0;
      const reader = response.body?.getReader();
      if (!reader) throw new Error("Missing HTTP response body");
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          bytes += value.length;
          if (bytes > 1024 * 1024) { await reader.cancel(); throw new Error("HTTP response too large"); }
          chunks.push(value);
        }
      } finally { reader.releaseLock(); }
      const data = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      if (!response.ok) {
        // An explicit failure can still follow a server-side side effect. Never automatically retry.
        submitted = false;
        throw new ControlError(response.status === 409 ? "CONFIG_CONFLICT" : "HTTP_ERROR", `HTTP ${response.status}: ${data.error ?? "request failed"}`);
      }
      if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Invalid HTTP response");
      if (path.startsWith("/print/") && (data.ok !== true || typeof data.jobId !== "string" || !data.jobId || !Number.isSafeInteger(data.byteLength) || data.byteLength < 1)) throw new Error("Invalid print acknowledgement");
      if (path === "/health" && data.ok !== true) throw new Error("Invalid health response");
      if (path === "/status" && (typeof data.hubInstanceId !== "string" || !data.hubInstanceId)) throw new Error("Invalid hub status");
      if (path.startsWith("/sim/config/")) {
        if (typeof data.hubInstanceId !== "string" || !data.hubInstanceId || !Number.isSafeInteger(data.revision) || data.revision < 0 || Object.keys(data.config ?? {}).length !== 6) throw new Error("Invalid config snapshot");
        validateConfigPatch(data.config);
        if (effect && (data.hubInstanceId !== (body as any).hubInstanceId || data.revision !== (body as any).revision + 1)) throw new Error("Invalid config acknowledgement");
      }
      submitted = false;
      return data;
    } catch (err) {
      if (err instanceof ControlError) throw err;
      throw new ControlError(effect ? "RESULT_UNKNOWN" : controller.signal.aborted ? "TIMEOUT" : "CONNECTION_FAILED", effect ? "Request may have taken effect; inspect the hub before retrying" : "Request failed or timed out", effect ? 3 : 1);
    }
  }
  const file = () => options.file ?? usage("--file is required");
  const snapshot = () => api("/sim/config/snapshot");
  let result: unknown;
  if (command === "schema") result = { schemaVersion: 1, commands, scenarios, envelope: { schemaVersion: 1, requestId: "string (correlation only)", ok: "boolean", result: "command result", error: { code: "string", message: "string", details: "optional" } }, exitCodes: { success: 0, failure: 1, usage: 2, resultUnknown: 3, SIGINT: 130, SIGTERM: 143 } };
  else if (command === "health" || command === "status") result = await api(`/${command}`);
  else if (command === "config-get") result = await snapshot();
  else if (command === "config-backup") {
    const path = file();
    const data = await snapshot();
    await writeFile(path, JSON.stringify({ schemaVersion: 1, origin: base.origin, ...data }, null, 2) + "\n", { flag: "wx", mode: 0o600 });
    result = { ...data, file: path };
  } else if (command === "config-set" || command === "config-restore") {
    let config: unknown;
    let current: any;
    if (command === "config-restore") {
      const revision = integer(options["expected-revision"], "expected-revision", 0, Number.MAX_SAFE_INTEGER);
      const backupPath = file();
      const info = await stat(backupPath);
      if (!info.isFile() || info.size > 64 * 1024) usage("Backup must be a regular file up to 64 KiB");
      const backupText = await readFile(backupPath, "utf8");
      if (Buffer.byteLength(backupText) > 64 * 1024) usage("Backup file grew beyond 64 KiB");
      let backup: any;
      try { backup = JSON.parse(backupText); } catch { usage("Backup must be valid JSON"); }
      if (!backup || typeof backup !== "object") usage("Invalid backup");
      if (backup.schemaVersion !== 1 || backup.origin !== base.origin || typeof backup.hubInstanceId !== "string") usage("Backup origin or schema mismatch");
      config = backup.config;
      current = { hubInstanceId: backup.hubInstanceId, revision };
    } else {
      try { config = JSON.parse(options.args ?? usage("--args is required")); } catch { usage("--args must be valid JSON"); }
      if (Boolean(options["expected-revision"]) !== Boolean(options["hub-instance-id"])) usage("Provide both --expected-revision and --hub-instance-id");
      current = options["hub-instance-id"] ? { hubInstanceId: options["hub-instance-id"], revision: integer(options["expected-revision"], "expected-revision", 0, Number.MAX_SAFE_INTEGER) } : await snapshot();
    }
    try { validateConfigPatch(config); } catch (err) { usage((err as Error).message); }
    result = await api("/sim/config/compare-and-set", { hubInstanceId: current.hubInstanceId, revision: current.revision, config });
  } else if (command.startsWith("print-") || command === "jobs-wait") {
    let payload: Buffer | undefined;
    let endpoint = "/print/raw";
    if (command.startsWith("print-")) {
      const path = file();
      const info = await stat(path);
      if (!info.isFile() || info.size < 1 || info.size > MAX_PAYLOAD) usage("Print file must contain 1..20971520 bytes");
      payload = await readFile(path);
      if (!payload.length || payload.length > MAX_PAYLOAD) usage("Print file size changed outside permitted range");
      if (command === "print-image") {
        const protocol = options.protocol ?? "escpos";
        if (!["escpos", "tspl"].includes(protocol)) usage("Invalid image protocol");
        const width = integer(options.width ?? "384", "width", 1, 4096);
        endpoint = `/print/image?protocol=${protocol}&width=${width}`;
      }
    }
    if (wait || command === "jobs-wait") {
      const status = await api("/status");
      const wsUrl = new URL(base); wsUrl.protocol = base.protocol === "https:" ? "wss:" : "ws:";
      // Bridge WebSocket shares the HTTP listener; never trust a returned LAN hostname.
      capture = new JobCapture(wsUrl, controller.signal, status.hubInstanceId);
      await capture.ready;
    }
    if (command === "jobs-wait") result = await capture!.wait(options["job-id"]);
    else {
      result = await api(endpoint, payload, true);
      acceptedJobId = (result as any).jobId;
      if (wait) {
        if (typeof acceptedJobId !== "string") throw new ControlError("RESULT_UNKNOWN", "Missing job ID in print response", 3);
        try { result = { ...(await capture!.wait(acceptedJobId)), jobId: acceptedJobId }; }
        catch { throw new ControlError("RESULT_UNKNOWN", "Print accepted but capture was not confirmed; do not blindly retry", 3, { jobId: acceptedJobId }); }
      }
    }
  }
  process.stdout.write(JSON.stringify({ schemaVersion: 1, requestId, ok: true, result }) + "\n");
}
main().catch((err) => {
  const error = err instanceof ControlError ? err : new ControlError("EXECUTION_ERROR", err instanceof Error ? err.message : "Execution failed");
  if (signalExit && !submitted && !acceptedJobId) { error.code = "CANCELLED"; error.message = "Operation cancelled"; }
  if (signalExit && submitted) { error.code = "RESULT_UNKNOWN"; error.message = "Interrupted after submission; inspect the hub before retrying"; }
  process.stdout.write(JSON.stringify({ schemaVersion: 1, requestId, ok: false, error: { code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}), ...(acceptedJobId ? { jobId: acceptedJobId } : {}) } }) + "\n");
  process.exitCode = signalExit ?? error.exitCode;
}).finally(() => { if (timer) clearTimeout(timer); capture?.close(); });
