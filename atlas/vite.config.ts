import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // No PostCSS; don't pick up config from parent folders.
  css: { postcss: {} },
  server: { proxy: { "/api": "http://localhost:8787" } },
  build: { outDir: "dist", chunkSizeWarningLimit: 700 },
});
