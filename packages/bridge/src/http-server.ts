import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { VirtPrinterBridge } from "./bridge.js";
import { tryServeStatic } from "./web-static.js";

export interface HttpServerOptions {
  port: number;
  host: string;
  bridge: VirtPrinterBridge;
  webRoot?: string | null;
}

function readBody(req: IncomingMessage, limit = 20 * 1024 * 1024): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error("body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(data);
}

function corsPreflight(res: ServerResponse): void {
  res.writeHead(204, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end();
}

function httpClientIp(req: IncomingMessage): string {
  return req.socket.remoteAddress?.replace("::ffff:", "") ?? "unknown";
}

export function startHttpServer(options: HttpServerOptions): Server {
  const { port, host, bridge, webRoot = null } = options;

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

    if (req.method === "OPTIONS") {
      corsPreflight(res);
      return;
    }

    if (webRoot && (await tryServeStatic(webRoot, req, res, url.pathname))) {
      return;
    }

    if (req.method === "GET" && url.pathname === "/health") {
      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.method === "GET" && url.pathname === "/status") {
      sendJson(res, 200, bridge.getPublicStatus());
      return;
    }

    if (req.method === "GET" && url.pathname === "/sim/config") {
      sendJson(res, 200, bridge.getPrinterSimConfig());
      return;
    }

    if (req.method === "POST" && url.pathname === "/sim/config") {
      try {
        const raw = await readBody(req, 64 * 1024);
        const json = JSON.parse(raw.toString("utf8")) as Partial<import("@virt-printer/shared").PrinterSimConfig>;
        const config = bridge.setPrinterSimConfig(json, httpClientIp(req));
        sendJson(res, 200, config);
      } catch (err) {
        sendJson(res, 400, { error: err instanceof Error ? err.message : "invalid config" });
      }
      return;
    }

    if (req.method === "POST" && url.pathname === "/sim/drawer/kick") {
      try {
        const raw = await readBody(req, 4096);
        const json = raw.length > 0 ? (JSON.parse(raw.toString("utf8")) as { pin?: number }) : {};
        const event = bridge.kickCashDrawer(json.pin ?? 0, httpClientIp(req));
        sendJson(res, 200, { ok: true, event });
      } catch (err) {
        sendJson(res, 400, { error: err instanceof Error ? err.message : "kick failed" });
      }
      return;
    }

    if (req.method === "GET" && url.pathname === "/" && !webRoot) {
      sendJson(res, 503, {
        error: "web ui not built",
        hint: "Run from repo root: pnpm install && pnpm start",
        api: ["/health", "/status", "/print/raw", "/sim/config", "/sim/drawer/kick"],
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/print/raw") {
      try {
        const ct = req.headers["content-type"] ?? "";
        let payload: Buffer;

        if (ct.includes("application/json")) {
          const raw = await readBody(req);
          const json = JSON.parse(raw.toString("utf8")) as {
            dataBase64?: string;
            dataHex?: string;
          };
          if (json.dataBase64) {
            payload = Buffer.from(json.dataBase64.replace(/\s/g, ""), "base64");
          } else if (json.dataHex) {
            const cleaned = json.dataHex.replace(/[^0-9a-fA-F]/g, "");
            if (cleaned.length % 2 !== 0) {
              sendJson(res, 400, { error: "hex input has odd length" });
              return;
            }
            payload = Buffer.from(cleaned, "hex");
          } else {
            sendJson(res, 400, { error: "missing dataBase64 or dataHex" });
            return;
          }
        } else {
          payload = await readBody(req);
        }

        if (payload.length === 0) {
          sendJson(res, 400, { error: "empty body" });
          return;
        }

        const job = bridge.ingestRaw(payload, httpClientIp(req));
        sendJson(res, 200, { ok: true, jobId: job.id, byteLength: job.byteLength, protocol: job.protocol });
      } catch (err) {
        sendJson(res, 500, { error: err instanceof Error ? err.message : "print failed" });
      }
      return;
    }

    if (req.method === "POST" && url.pathname === "/print/image") {
      try {
        const protocol = (url.searchParams.get("protocol") ?? "escpos") as "escpos" | "tspl";
        const width = Number(url.searchParams.get("width") ?? 384);
        const ct = req.headers["content-type"] ?? "";

        let imageBuf: Buffer;
        if (ct.includes("application/json")) {
          const raw = await readBody(req);
          const json = JSON.parse(raw.toString("utf8")) as { imageBase64?: string; protocol?: string; width?: number };
          if (!json.imageBase64) {
            sendJson(res, 400, { error: "missing imageBase64" });
            return;
          }
          imageBuf = Buffer.from(json.imageBase64, "base64");
        } else {
          imageBuf = await readBody(req);
        }

        if (imageBuf.length === 0) {
          sendJson(res, 400, { error: "empty body" });
          return;
        }

        const job = await bridge.ingestImage(imageBuf, {
          protocol,
          maxWidth: Number.isFinite(width) ? width : 384,
          sourceIp: httpClientIp(req),
        });
        sendJson(res, 200, { ok: true, jobId: job.id, byteLength: job.byteLength });
      } catch (err) {
        sendJson(res, 500, { error: err instanceof Error ? err.message : "print failed" });
      }
      return;
    }

    sendJson(res, 404, { error: "not found" });
  });

  server.listen(port, host);
  return server;
}
