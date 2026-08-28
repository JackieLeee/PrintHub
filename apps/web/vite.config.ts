import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const rootPkg = JSON.parse(readFileSync(join(here, "../../package.json"), "utf8")) as {
  version?: string;
};

const repoName = process.env.VITE_REPO_NAME ?? "PrintHub";
const isDesktop = process.env.VITE_DESKTOP === "1";
const base = isDesktop ? "./" : process.env.GITHUB_ACTIONS ? `/${repoName}/` : "/";

export default defineConfig({
  base,
  plugins: [react()],
  define: {
    "import.meta.env.VITE_APP_VERSION": JSON.stringify(rootPkg.version ?? "1.0.0"),
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      "/status": "http://localhost:8081",
      "/health": "http://localhost:8081",
      "/print": "http://localhost:8081",
    },
  },
});
