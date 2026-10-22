// Builds the Claude artifact edition as one self-contained page:
//   npm run artifact  ->  dist-artifact/batch-signal.html
// The Artifact tool wraps it in <html>/<head>/<body>, so it holds only the
// title, fonts, inline CSS, the mount point and the inline bundle.
import { execSync } from "node:child_process";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";

const out = new URL("../dist-artifact/", import.meta.url);
execSync("npx vite build --outDir dist-artifact --emptyOutDir", {
  stdio: "inherit",
  env: { ...process.env, VITE_TARGET: "artifact" },
  cwd: new URL("..", import.meta.url),
});

const assets = new URL("assets/", out);
const files = readdirSync(assets);
const css = files.filter((f) => f.endsWith(".css")).map((f) => readFileSync(new URL(f, assets), "utf8")).join("\n");
// "</script" inside the bundle would end the inline script early.
const js = files
  .filter((f) => f.endsWith(".js"))
  .map((f) => readFileSync(new URL(f, assets), "utf8").replace(/<\/script/gi, "<\\/script"))
  .join("\n");

const page = `<title>Batch Signal</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Schibsted+Grotesk:wght@400;500;600;700&family=Spline+Sans+Mono:wght@400;500&display=swap">
<style>
${css}
</style>
<div id="root"></div>
<script type="module">
${js}
</script>
`;
writeFileSync(new URL("batch-signal.html", out), page);
console.log(`artifact: dist-artifact/batch-signal.html (${Math.round(page.length / 1024)} KB)`);
