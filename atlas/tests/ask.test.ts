// Exercises the answer loop against a scripted stand-in for the Messages API.
import { describe, expect, it } from "vitest";
import atlasJson from "../shared/atlas.generated.json";
import type { AskEvent } from "../shared/card";
import type { Atlas } from "../shared/types";
import { answer, BUDGET, type AskDeps, type AskInput } from "../server/ask";

const atlas = atlasJson as Atlas;

type Turn = { stop_reason: string; content: unknown[] };
let toolSeq = 0;
const toolUse = (name: string, input: unknown) => ({ type: "tool_use", id: `tu_${++toolSeq}`, name, input });

function scripted(turns: Turn[] | ((req: any, i: number) => Turn)) {
  const requests: any[] = [];
  const messages = {
    create: async (req: any) => {
      requests.push(structuredClone(req));
      const i = requests.length - 1;
      const t = typeof turns === "function" ? turns(req, i) : turns[i];
      if (!t) throw new Error("script ran out");
      return { id: `msg_${i}`, type: "message", role: "assistant", model: req.model, usage: {}, ...t };
    },
  };
  return { messages: messages as unknown as AskDeps["messages"], requests };
}

const deps = (messages: AskDeps["messages"], extra: Partial<AskDeps> = {}): AskDeps => ({
  atlas,
  messages,
  model: "claude-opus-5-5",
  effort: "low",
  searchProvider: "exa",
  ...extra,
});

async function collect(input: AskInput, d: AskDeps) {
  const events: AskEvent[] = [];
  for await (const e of answer(input, d)) events.push(e);
  return events;
}

const base: AskInput = { question: "What has Edgerun raised?", tier: "official", context: { group: null, company: "edgerun" } };

describe("answer loop", () => {
  it("runs snapshot tools, then strips sources and slugs the model never saw", async () => {
    const { messages, requests } = scripted([
      { stop_reason: "tool_use", content: [toolUse("query_companies", { query: "exoskeletons" })] },
      {
        stop_reason: "tool_use",
        content: [
          toolUse("render_card", {
            summary: "Funding is not stated in the YC profile.",
            tier: "official",
            blocks: [
              { type: "companies", items: [{ slug: "edgerun" }, { slug: "made-up-co" }] },
              { type: "facts", items: [{ label: "Funding", value: "$40M", source: 1 }] },
            ],
            sources: [
              { title: "YC profile", url: "https://www.ycombinator.com/companies/edgerun", kind: "yc" },
              { title: "Invented", url: "https://example.com/edgerun-raises", kind: "press" },
            ],
            notStated: ["Total funding"],
            highlight: ["edgerun", "ghost"],
          }),
        ],
      },
    ]);
    const events = await collect(base, deps(messages));
    expect(events[0]).toEqual({ type: "step", label: "Searching the snapshot: exoskeletons" });
    const card = events.find((e) => e.type === "card");
    expect(card?.type).toBe("card");
    if (card?.type !== "card") return;
    expect(card.card.sources.map((s) => s.url)).toEqual(["https://www.ycombinator.com/companies/edgerun"]);
    const facts = card.card.blocks.find((b) => b.type === "facts");
    // The fact pointed at the invented source, so it loses its citation.
    if (facts?.type === "facts") expect(facts.items[0].source).toBeUndefined();
    const companies = card.card.blocks.find((b) => b.type === "companies");
    if (companies?.type === "companies") expect(companies.items.map((x) => x.slug)).toEqual(["edgerun"]);
    expect(card.card.highlight).toEqual(["edgerun"]);

    // The snapshot tool result reached the model, and the web tier's search tool was not offered.
    expect(JSON.stringify(requests[1].messages.at(-1))).toContain("Edgerun");
    const names = requests[0].tools.map((t: any) => t.name);
    expect(names).toEqual(["query_companies", "render_card", "web_fetch"]);
    expect(requests[0].tools[2].max_uses).toBe(BUDGET.official.fetches);
    expect(requests[0].tools[2].allowed_domains).toContain("ycombinator.com");
    expect(requests[0].fallbacks).toBe("default");
    expect(requests[0].output_config).toEqual({ effort: "low" });
  });

  it("keeps a fetched page as a citable source", async () => {
    const url = "https://www.edgerun.com/news/seed";
    const { messages } = scripted([
      {
        stop_reason: "tool_use",
        content: [
          { type: "server_tool_use", id: "srv_1", name: "web_fetch", input: { url } },
          { type: "web_fetch_tool_result", tool_use_id: "srv_1", content: { type: "web_fetch_result", url, retrieved_at: null, content: {} } },
          toolUse("render_card", { summary: "The company announced a seed round.", tier: "official", sources: [{ title: "Edgerun news", url, kind: "company" }] }),
        ],
      },
    ]);
    const events = await collect(base, deps(messages));
    expect(events[0]).toEqual({ type: "step", label: "Reading edgerun.com" });
    const card = events.at(-1);
    expect(card?.type === "card" && card.card.sources[0].url).toBe(url);
  });

  it("asks the model to fix an invalid card once, then gives up", async () => {
    const bad = () => ({ stop_reason: "tool_use", content: [toolUse("render_card", { tier: "official" })] });
    const { messages, requests } = scripted([bad(), bad()]);
    const events = await collect(base, deps(messages));
    expect(requests).toHaveLength(2);
    expect(JSON.stringify(requests[1].messages.at(-1))).toContain("Invalid card");
    expect(events.at(-1)).toEqual({ type: "error", message: "The answer didn't match the expected format." });
  });

  it("enforces the web search budget", async () => {
    let fetches = 0;
    const fakeFetch = (async () => {
      fetches++;
      return new Response(JSON.stringify({ results: [{ title: "T", url: `https://techcrunch.com/a${fetches}`, text: "x" }] }));
    }) as typeof fetch;
    const { messages, requests } = scripted((_req, i) =>
      i < 6
        ? { stop_reason: "tool_use", content: [toolUse("search_web", { query: `q${i}` })] }
        : { stop_reason: "tool_use", content: [toolUse("render_card", { summary: "Done.", tier: "web", sources: [{ title: "TC", url: "https://techcrunch.com/a1", kind: "press" }] })] },
    );
    const events = await collect({ ...base, tier: "web" }, deps(messages, { exaKey: "k", fetchImpl: fakeFetch }));
    expect(fetches).toBe(BUDGET.web.searches);
    expect(JSON.stringify(requests[6].messages.at(-1))).toContain("Search budget used up");
    const card = events.at(-1);
    expect(card?.type === "card" && card.card.sources[0].url).toBe("https://techcrunch.com/a1");
    expect(events.filter((e) => e.type === "step")).toHaveLength(BUDGET.web.searches);
  });

  it("uses Claude's built-in web search when Exa isn't configured", async () => {
    const { messages, requests } = scripted([
      { stop_reason: "tool_use", content: [toolUse("render_card", { summary: "x", tier: "web" })] },
    ]);
    await collect({ ...base, tier: "web" }, deps(messages, { searchProvider: "anthropic" }));
    const search = requests[0].tools.find((t: any) => t.name === "web_search");
    expect(search).toMatchObject({ type: "web_search_20260209", max_uses: BUDGET.web.searches });
    expect(search.allowed_domains).toContain("reuters.com");
  });

  it("never reports the web tier when only official sources were allowed", async () => {
    const { messages } = scripted([{ stop_reason: "tool_use", content: [toolUse("render_card", { summary: "x", tier: "web" })] }]);
    const events = await collect(base, deps(messages));
    const card = events.at(-1);
    expect(card?.type === "card" && card.card.tier).toBe("official");
  });

  it("surfaces refusals as an error", async () => {
    const { messages } = scripted([{ stop_reason: "refusal", content: [] }]);
    const events = await collect(base, deps(messages));
    expect(events).toEqual([{ type: "error", message: "This question was declined. Try rephrasing it." }]);
  });

  it("stops after the turn budget", async () => {
    const { messages, requests } = scripted(() => ({ stop_reason: "tool_use", content: [toolUse("query_companies", { query: "a" })] }));
    const events = await collect(base, deps(messages));
    expect(requests).toHaveLength(BUDGET.turns);
    expect(events.at(-1)?.type).toBe("error");
  });
});
