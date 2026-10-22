// Keeps model-written cards honest: schema-checked, and citing only what was actually retrieved.
import { CardSchema, type Card } from "./card";
import type { Atlas } from "./types";

export const normalizeUrl = (url: string) => {
  try {
    const u = new URL(url);
    return `${u.hostname.replace(/^www\./, "")}${u.pathname.replace(/\/$/, "")}`;
  } catch {
    return url;
  }
};

/** Drop anything the model could not have seen or that points outside the snapshot. */
export function sanitizeCard(raw: unknown, atlas: Atlas, seen: Set<string>, maxTier: "dataset" | "official" | "web"): { card?: Card; error?: string } {
  const parsed = CardSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  const card = parsed.data;
  const known = new Set(atlas.companies.map((c) => c.slug));
  const keep = card.sources.map((s) => seen.has(normalizeUrl(s.url)));
  const remap = new Map<number, number>();
  card.sources.forEach((_, i) => keep[i] && remap.set(i, remap.size));
  card.sources = card.sources.filter((_, i) => keep[i]);
  card.blocks = card.blocks.map((b) => {
    if (b.type === "companies") return { ...b, items: b.items.filter((x) => known.has(x.slug)) };
    if (b.type === "bars") return { ...b, items: b.items.map((x) => (x.slug && !known.has(x.slug) ? { ...x, slug: undefined } : x)) };
    if (b.type === "facts") return { ...b, items: b.items.map((x) => (x.source === undefined ? x : { ...x, source: remap.get(x.source) })) };
    return b;
  });
  card.highlight = card.highlight.filter((s) => known.has(s));
  if (card.tier === "web" && maxTier !== "web") card.tier = maxTier;
  if (card.tier === "official" && maxTier === "dataset") card.tier = "dataset";
  if (card.tier === "tour") card.tier = "dataset";
  return { card };
}
