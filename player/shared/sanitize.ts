// Keeps Claude-written cards honest: schema-checked, and citing only URLs the atlas holds.
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

/** Drop sources Claude could not have seen and ids that aren't in the atlas. */
export function sanitizeCard(raw: unknown, atlas: Atlas, seen: Set<string>): { card?: Card; error?: string } {
  const parsed = CardSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  const card = parsed.data;
  const known = new Set(atlas.items.map((it) => it.id));
  const keep = card.sources.map((s) => seen.has(normalizeUrl(s.url)));
  const remap = new Map<number, number>();
  card.sources.forEach((_, i) => keep[i] && remap.set(i, remap.size));
  card.sources = card.sources.filter((_, i) => keep[i]);
  card.blocks = card.blocks.map((b) => {
    if (b.type === "items") return { ...b, items: b.items.filter((x) => known.has(x.id)) };
    if (b.type === "bars") return { ...b, items: b.items.map((x) => (x.id && !known.has(x.id) ? { ...x, id: undefined } : x)) };
    if (b.type === "facts") return { ...b, items: b.items.map((x) => (x.source === undefined ? x : { ...x, source: remap.get(x.source) })) };
    return b;
  });
  card.highlight = card.highlight.filter((id) => known.has(id));
  return { card };
}
