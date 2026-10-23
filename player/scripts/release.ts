// Builds the player once and writes it into the skill as a template:
//   npm run release  ->  ../skills/atlas-briefing/assets/player.html
// The skill's build.mjs inlines a collection into that template, so people
// using the skill never need npm, Vite or this folder.
import { execSync } from "node:child_process";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";

const out = new URL("../dist/", import.meta.url);
execSync("npx vite build --outDir dist --emptyOutDir", { stdio: "inherit", cwd: new URL("..", import.meta.url) });

const assets = new URL("assets/", out);
const files = readdirSync(assets);
const css = files.filter((f) => f.endsWith(".css")).map((f) => readFileSync(new URL(f, assets), "utf8")).join("\n");
// "</script" inside the bundle would end the inline script early.
const js = files
  .filter((f) => f.endsWith(".js"))
  .map((f) => readFileSync(new URL(f, assets), "utf8").replace(/<\/script/gi, "<\\/script"))
  .join("\n");

// The Artifact tool wraps a page in <html>/<head>/<body>, so the template is a fragment.
const page = `<title>Atlas Briefing</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Schibsted+Grotesk:wght@400;500;600;700&family=Spline+Sans+Mono:wght@400;500&display=swap">
<script>try { if (localStorage.getItem("atlas-mode") === "dark") document.documentElement.dataset.mode = "dark"; } catch (e) {}</script>
<style>
${css}
</style>
<div id="root"></div>
<script type="application/json" id="atlas-data">/*ATLAS_DATA*/</script>
<script type="module">
${js}
</script>
`;
const dest = new URL("../../skills/atlas-briefing/assets/player.html", import.meta.url);
writeFileSync(dest, page);
console.log(`player template: skills/atlas-briefing/assets/player.html (${Math.round(page.length / 1024)} KB)`);
