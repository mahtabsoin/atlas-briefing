import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Keep the legacy app in the parent folder from leaking its PostCSS setup in.
  css: { postcss: {} },
  server: { proxy: { "/api": "http://localhost:8787" } },
  build: { outDir: "dist", chunkSizeWarningLimit: 700 },
});
