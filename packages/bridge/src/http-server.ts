import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { VirtPrinterBridge } from "./bridge.js";

export interface HttpServerOptions {
  port: number;
  host: string;
  bridge: VirtPrinterBridge;
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

export function startHttpServer(options: HttpServerOptions): Server {
  const { port, host, bridge } = options;

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

    if (req.method === "OPTIONS") {
      corsPreflight(res);
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
          sourceIp: req.socket.remoteAddress?.replace("::ffff:", "") ?? "http",
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
