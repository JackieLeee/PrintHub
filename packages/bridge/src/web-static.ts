import { existsSync } from "node:fs";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";
import type { IncomingMessage, ServerResponse } from "node:http";

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function findMonorepoRoot(startDir: string): string | null {
  let dir = startDir;
  for (let i = 0; i < 8; i++) {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

/** Locate built Web UI (`apps/web/dist`). */
export function resolveWebRoot(): string | null {
  const envDir = process.env.VPH_WEB_DIR;
  if (envDir && existsSync(join(envDir, "index.html"))) return envDir;

  const here = dirname(fileURLToPath(import.meta.url));
  const roots = new Set<string>();
  const monoFromHere = findMonorepoRoot(here);
  const monoFromCwd = findMonorepoRoot(process.cwd());
  if (monoFromHere) roots.add(monoFromHere);
  if (monoFromCwd) roots.add(monoFromCwd);
  roots.add(process.cwd());

  const candidates: string[] = [];
  for (const root of roots) {
    candidates.push(join(root, "apps/web/dist"));
  }
  candidates.push(
    join(here, "../../../apps/web/dist"),
    join(here, "../../../../apps/web/dist"),
    join(process.cwd(), "apps/web/dist"),
    join(process.cwd(), "../apps/web/dist"),
  );

  for (const dir of candidates) {
    if (existsSync(join(dir, "index.html"))) return dir;
  }
  return null;
}

function contentType(filePath: string): string {
  return MIME[extname(filePath).toLowerCase()] ?? "application/octet-stream";
}

function isApiPath(pathname: string): boolean {
  return pathname === "/health" || pathname === "/status" || pathname.startsWith("/print/");
}

/** Serve static SPA assets; returns true if handled. */
export async function tryServeStatic(
  webRoot: string,
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
): Promise<boolean> {
  if (req.method !== "GET" && req.method !== "HEAD") return false;
  if (isApiPath(pathname)) return false;

  const { readFile } = await import("node:fs/promises");
  const safePath = pathname.replace(/\.\./g, "");
  let filePath = join(webRoot, safePath === "/" ? "index.html" : safePath);

  if (!existsSync(filePath) || !filePath.startsWith(webRoot)) {
    filePath = join(webRoot, "index.html");
  }

  try {
    const data = await readFile(filePath);
    res.writeHead(200, {
      "Content-Type": contentType(filePath),
      "Cache-Control": filePath.includes("/assets/")
        ? "public, max-age=31536000, immutable"
        : "no-cache",
    });
    if (req.method === "HEAD") res.end();
    else res.end(data);
    return true;
  } catch {
    return false;
  }
}
