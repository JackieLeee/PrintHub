import { createServer, type Server } from "node:http";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";

let server: Server | null = null;
let boundPort = 0;

function mimeType(filePath: string): string {
  switch (extname(filePath)) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".js":
      return "text/javascript; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    case ".png":
      return "image/png";
    case ".json":
      return "application/json";
    case ".woff2":
      return "font/woff2";
    default:
      return "application/octet-stream";
  }
}

function listenOnPort(root: string, port: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const next = createServer(async (req, res) => {
      try {
        const url = new URL(req.url ?? "/", "http://127.0.0.1");
        let pathname = decodeURIComponent(url.pathname);
        if (pathname === "/" || pathname === "") pathname = "/index.html";

        const filePath = normalize(join(root, pathname.replace(/^\//, "")));
        if (!filePath.startsWith(root) || !existsSync(filePath)) {
          res.writeHead(404);
          res.end("Not Found");
          return;
        }

        const body = await readFile(filePath);
        res.writeHead(200, {
          "Content-Type": mimeType(filePath),
          "Cache-Control": "no-cache",
        });
        res.end(body);
      } catch (err) {
        console.error("[desktop] ui-server error:", err);
        res.writeHead(500);
        res.end("Internal Server Error");
      }
    });

    next.on("error", (err: NodeJS.ErrnoException) => {
      reject(err);
    });

    next.listen(port, "127.0.0.1", () => {
      server = next;
      const addr = next.address();
      if (!addr || typeof addr === "string") {
        reject(new Error("ui-server failed to bind"));
        return;
      }
      boundPort = addr.port;
      console.log(`[desktop] UI http://127.0.0.1:${boundPort}`);
      resolve(boundPort);
    });
  });
}

export async function startUiServer(webRoot: string, preferredPort = 0): Promise<number> {
  await stopUiServer();
  const root = normalize(`${webRoot}${sep}`);

  try {
    return await listenOnPort(root, preferredPort);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (preferredPort !== 0 && code === "EADDRINUSE") {
      console.warn(`[desktop] UI port ${preferredPort} busy, picking another`);
      return listenOnPort(root, 0);
    }
    throw err;
  }
}

export async function stopUiServer(): Promise<void> {
  if (!server) return;
  const current = server;
  server = null;
  boundPort = 0;
  await new Promise<void>((resolve) => {
    current.close(() => resolve());
  });
}

export function uiWindowUrl(): string {
  if (boundPort <= 0) throw new Error("ui-server not started");
  return `http://127.0.0.1:${boundPort}/?desktop=1`;
}
