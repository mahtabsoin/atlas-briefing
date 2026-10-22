// Re-runs the grouping with two independent model passes and reports agreement.
// Placements need a verbatim supporting phrase from the company's own one-liner.
//
//   npm run classify            -> writes data/assignments.candidate.json + data/classify-report.md
//   npm run classify -- --write -> also replaces data/assignments.json with the agreed placements
//
// Needs ANTHROPIC_API_KEY. About 460 short requests.
import { readFileSync, writeFileSync } from "node:fs";
import Anthropic from "@anthropic-ai/sdk";

type Raw = { companies: { slug: string; name: string; one_liner: string; description?: string }[] };
type GroupDef = { id: string; name: string; rubric: string };
type Placement = { group: number; evidence: [number, number] | null };
type Vote = { group: number; quote: string };

const read = <T>(p: string): T => JSON.parse(readFileSync(new URL(p, import.meta.url), "utf8"));
const MODEL = process.env.ATLAS_MODEL || "claude-opus-5-5";
const CONCURRENCY = 6;

const SCHEMA = {
  type: "object",
  properties: {
    group: { type: "integer", description: "Group number, or -1 if none fits clearly" },
    quote: { type: "string", description: "Exact phrase copied from the one-liner that supports the group, or empty" },
  },
  required: ["group", "quote"],
  additionalProperties: false,
};

function prompt(groups: GroupDef[], order: number[], c: Raw["companies"][number], variant: "a" | "b"): string {
  const list = order.map((i) => `${i}: ${groups[i].name}. ${groups[i].rubric}`).join("\n");
  const ask =
    variant === "a"
      ? "Which group does this company belong to, judged only by how it describes itself?"
      : "Read the company's own words. If exactly one of these groups clearly describes what it does, name it; otherwise answer -1.";
  return `${ask}

Groups:
${list}

Company: ${c.name}
One-liner: ${c.one_liner.trim()}
Description: ${(c.description ?? "").trim() || "(none)"}

Return the group number and the shortest exact phrase from the one-liner that supports it. If the one-liner has no such phrase but the description makes the group clear, return the group with an empty quote. If no group fits clearly, return -1.`;
}

async function vote(client: Anthropic, text: string, groupCount: number): Promise<Vote> {
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 1000,
    output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
    messages: [{ role: "user", content: text }],
  });
  if (res.stop_reason === "refusal") return { group: -1, quote: "" };
  const block = res.content.find((b) => b.type === "text");
  const parsed = JSON.parse(block && block.type === "text" ? block.text : "{}") as Partial<Vote>;
  const group = Number.isInteger(parsed.group) && parsed.group! >= -1 && parsed.group! < groupCount ? parsed.group! : -1;
  return { group, quote: typeof parsed.quote === "string" ? parsed.quote : "" };
}

/** A quote only counts if it appears verbatim (case-insensitive) in the one-liner. */
export function locate(oneLiner: string, quote: string): [number, number] | null {
  const q = quote.trim();
  if (q.length < 2) return null;
  const i = oneLiner.toLowerCase().indexOf(q.toLowerCase());
  return i < 0 ? null : [i, i + q.length];
}

async function pool<T, R>(items: T[], n: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i], i);
      }
    }),
  );
  return out;
}

async function main() {
  const raw = read<Raw>("../data/yc-s26-snapshot.json");
  const { groups } = read<{ groups: GroupDef[] }>("../data/groups.json");
  const curated = read<{ assignments: Record<string, Placement> }>("../data/assignments.json").assignments;
  const client = new Anthropic();
  const forward = groups.map((_, i) => i);
  const reversed = [...forward].reverse();

  let done = 0;
  const results = await pool(raw.companies, CONCURRENCY, async (c) => {
    const [a, b] = await Promise.all([
      vote(client, prompt(groups, forward, c, "a"), groups.length),
      vote(client, prompt(groups, reversed, c, "b"), groups.length),
    ]);
    if (++done % 20 === 0) console.log(`${done}/${raw.companies.length}`);
    return { c, a, b };
  });

  const agreed: Record<string, Placement> = {};
  const disagreements: string[] = [];
  const changes: string[] = [];
  let agree = 0;
  for (const { c, a, b } of results) {
    const oneLiner = c.one_liner.trim();
    if (a.group === b.group) {
      agree++;
      if (a.group >= 0) agreed[c.slug] = { group: a.group, evidence: locate(oneLiner, a.quote) ?? locate(oneLiner, b.quote) };
    } else {
      disagreements.push(`| ${c.name} | ${oneLiner} | ${label(groups, a.group)} | ${label(groups, b.group)} | ${label(groups, curated[c.slug]?.group ?? -1)} |`);
    }
    const now = a.group === b.group ? a.group : null;
    const before = curated[c.slug]?.group ?? -1;
    if (now !== null && now !== before) changes.push(`| ${c.name} | ${label(groups, before)} | ${label(groups, now)} |`);
  }

  const total = raw.companies.length;
  const report = [
    `# Classification report`,
    ``,
    `Model: ${MODEL}. Two independent passes per company (different wording and group order).`,
    ``,
    `- Agreement: ${agree} of ${total} (${((agree / total) * 100).toFixed(1)}%)`,
    `- Agreed placements in a group: ${Object.keys(agreed).length}`,
    `- With a verbatim supporting phrase: ${Object.values(agreed).filter((p) => p.evidence).length}`,
    `- Disagreements for human review: ${disagreements.length}`,
    `- Changes versus the curated set: ${changes.length}`,
    ``,
    `## Disagreements`,
    ``,
    `| Company | One-liner | Pass A | Pass B | Curated |`,
    `|---|---|---|---|---|`,
    ...disagreements,
    ``,
    `## Changes versus curated`,
    ``,
    `| Company | Curated | Model (agreed) |`,
    `|---|---|---|`,
    ...changes,
    ``,
  ].join("\n");

  const method = `model-two-pass:${MODEL}`;
  writeFileSync(new URL("../data/assignments.candidate.json", import.meta.url), JSON.stringify({ method, assignments: agreed }, null, 1));
  writeFileSync(new URL("../data/classify-report.md", import.meta.url), report);
  if (process.argv.includes("--write")) {
    writeFileSync(new URL("../data/assignments.json", import.meta.url), JSON.stringify({ method, assignments: agreed }, null, 1));
    console.log("Replaced data/assignments.json. Update the counts in data/groups.json if `npm run atlas` reports a mismatch.");
  }
  console.log(`Agreement ${agree}/${total}. Report: data/classify-report.md`);
}

const label = (groups: GroupDef[], g: number) => (g >= 0 ? groups[g].name : "none");

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    if (err instanceof Anthropic.AuthenticationError) console.error("Set ANTHROPIC_API_KEY to run classification.");
    else console.error(err);
    process.exit(1);
  });
}
