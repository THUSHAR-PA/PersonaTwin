import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

// A separate build only. The normal application always uses the authenticated API.
export default defineConfig({
  root: fileURLToPath(new URL("./preview", import.meta.url)),
  plugins: [react()],
  resolve: {
    alias: [{
      find: /^\.\/useTwinDashboard$/,
      replacement: fileURLToPath(new URL("./src/digital-twin/preview/demoHooks.js", import.meta.url)),
    }],
  },
  build: {
    outDir: fileURLToPath(new URL("./dist-preview", import.meta.url)),
    emptyOutDir: true,
  },
});
