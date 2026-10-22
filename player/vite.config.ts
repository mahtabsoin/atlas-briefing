import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { buildAtlas } from "../skills/atlas-briefing/scripts/build.mjs";

/** In dev, inline a collection the same way the skill's builder does. ATLAS=path/to/collection.json picks another. */
function devAtlas(): Plugin {
  const file = resolve(process.env.ATLAS ?? "../atlases/yc-s26/collection.json");
  return {
    name: "dev-atlas",
    apply: "serve",
    transformIndexHtml(html) {
      const { atlas } = buildAtlas(JSON.parse(readFileSync(file, "utf8")));
      return html.replace("/*ATLAS_DATA*/", () => JSON.stringify(atlas).replace(/</g, "\\u003c"));
    },
  };
}

export default defineConfig({
  plugins: [react(), devAtlas()],
  // No PostCSS; don't pick up config from parent folders.
  css: { postcss: {} },
  build: { outDir: "dist", chunkSizeWarningLimit: 700 },
});
