import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const repoName = process.env.VITE_REPO_NAME ?? "virt-printer-hub";
const base = process.env.GITHUB_ACTIONS ? `/${repoName}/` : "/";

export default defineConfig({
  base,
  plugins: [react()],
  server: {
    port: 5173,
  },
});
