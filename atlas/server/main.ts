// HTTP server: the answer API, optional agent hand-off, and the built app.
import { readFileSync } from "node:fs";
import Anthropic from "@anthropic-ai/sdk";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import type { Atlas } from "../shared/types";
import { answer, type AskInput } from "./ask";
import { RateLimiter } from "./rate-limit";

const atlas: Atlas = JSON.parse(readFileSync(new URL("../shared/atlas.generated.json", import.meta.url), "utf8"));
const env = process.env;
const anthropic = env.ANTHROPIC_API_KEY ? new Anthropic() : null;
const searchProvider = env.SEARCH_PROVIDER === "anthropic" || !env.EXA_API_KEY ? "anthropic" : "exa";
const effort = (["low", "medium", "high"].includes(env.ATLAS_EFFORT ?? "") ? env.ATLAS_EFFORT : "low") as "low" | "medium" | "high";
const askLimiter = new RateLimiter(Number(env.ASK_LIMIT_PER_HOUR ?? 30), 60 * 60 * 1000);

const app = new Hono();
const clientId = (c: { req: { header(name: string): string | undefined } }) =>
  c.req.header("x-forwarded-for")?.split(",")[0].trim() || c.req.header("x-real-ip") || "local";

app.get("/api/health", (c) =>
  c.json({
    answers: !!anthropic,
    search: anthropic ? searchProvider : null,
    handoff: !!env.AGENT_WEBHOOK_URL,
  }),
);

app.post("/api/ask", async (c) => {
  if (!anthropic) return c.json({ error: "Live answers are not configured on this server." }, 503);
  if (!askLimiter.take(clientId(c))) return c.json({ error: "Question limit reached for now. Try again later." }, 429);
  const body = await c.req.json().catch(() => null);
  const question = typeof body?.question === "string" ? body.question.trim().slice(0, 500) : "";
  if (!question) return c.json({ error: "Empty question." }, 400);
  const input: AskInput = {
    question,
    tier: body.tier === "web" ? "web" : "official",
    context: {
      group: Number.isInteger(body.context?.group) ? body.context.group : null,
      company: typeof body.context?.company === "string" ? body.context.company : null,
    },
  };
  const encoder = new TextEncoder();
  let cancelled = false;
  const stream = new ReadableStream({
    cancel() {
      cancelled = true; // viewer left; stop spending on this answer
    },
    async start(controller) {
      for await (const event of answer(input, {
        atlas,
        messages: anthropic.beta.messages,
        model: env.ATLAS_MODEL || "claude-opus-5-5",
        effort,
        searchProvider,
        exaKey: env.EXA_API_KEY,
      })) {
        if (cancelled) return;
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      }
      controller.close();
    },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson", "cache-control": "no-store" } });
});

app.post("/api/handoff", async (c) => {
  if (!env.AGENT_WEBHOOK_URL) return c.json({ error: "No agent is connected to this server." }, 501);
  const body = await c.req.json().catch(() => null);
  if (!body || typeof body.task !== "string") return c.json({ error: "Missing task." }, 400);
  const res = await fetch(env.AGENT_WEBHOOK_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ source: "batch-signal", task: body.task.slice(0, 2000), context: body.context ?? null, sources: body.sources ?? [] }),
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);
  return res?.ok ? c.json({ ok: true }) : c.json({ error: "The agent endpoint did not accept the task." }, 502);
});

if (env.NODE_ENV === "production") {
  app.use("/*", serveStatic({ root: "./dist" }));
  app.get("*", serveStatic({ path: "./dist/index.html" }));
}

const port = Number(env.PORT ?? 8787);
serve({ fetch: app.fetch, port }, () => console.log(`Batch Signal server on http://localhost:${port}`));
