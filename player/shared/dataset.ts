// Deterministic queries over the atlas. Used for instant answers in the page
// and exposed to the viewer's Claude as tools.
import { formatFact, placeKey, type Atlas, type FactSpec, type Item } from "./types";

export const median = (values: number[]): number => {
  const xs = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (!xs.length) return 0;
  const m = Math.floor(xs.length / 2);
  return xs.length % 2 ? xs[m] : (xs[m - 1] + xs[m]) / 2;
};

export const inGroup = (atlas: Atlas, group: number | null): Item[] =>
  group === null ? atlas.items : atlas.items.filter((it) => it.group === group);

export const byId = (atlas: Atlas, id: string): Item | undefined => atlas.items.find((it) => it.id === id);

export const numbers = (items: Item[], key: string) => items.map((it) => it.facts[key]).filter((v): v is number => typeof v === "number");

export const groupMedian = (atlas: Atlas, group: number | null, key: string) => median(numbers(inGroup(atlas, group), key));

export type SearchParams = { query?: string; group?: number | null; limit?: number };

export function searchItems(atlas: Atlas, p: SearchParams): { total: number; items: Item[] } {
  const terms = (p.query ?? "").toLowerCase().split(/\s+/).filter(Boolean);
  let xs = inGroup(atlas, p.group ?? null);
  if (terms.length) {
    xs = xs.filter((it) => {
      const hay = [it.name, it.summary, it.description, ...it.tags, ...Object.values(it.facts).map(String)].join(" ").toLowerCase();
      return terms.every((t) => hay.includes(t));
    });
  }
  const limit = Math.max(1, Math.min(20, p.limit ?? 10));
  return { total: xs.length, items: xs.slice(0, limit) };
}

export function largest(atlas: Atlas, group: number | null, key: string, n = 6): Item[] {
  return inGroup(atlas, group)
    .filter((it) => typeof it.facts[key] === "number")
    .sort((a, b) => (b.facts[key] as number) - (a.facts[key] as number))
    .slice(0, n);
}

export function placeCounts(atlas: Atlas, group: number | null, key: string): [string, number][] {
  const counts = new Map<string, number>();
  for (const it of inGroup(atlas, group)) {
    const p = placeKey(it.facts[key]);
    counts.set(p, (counts.get(p) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

/** Longest item name contained in the text, so a short name doesn't shadow a longer match. */
export function findItemInText(atlas: Atlas, text: string): Item | undefined {
  const s = ` ${text.toLowerCase()} `;
  return atlas.items
    .filter((it) => it.name.length > 2 && new RegExp(`[^a-z0-9]${escapeRe(it.name.toLowerCase())}[^a-z0-9]`).test(s))
    .sort((a, b) => b.name.length - a.name.length)[0];
}

export function findGroupInText(atlas: Atlas, text: string): number | null {
  const s = text.toLowerCase();
  const i = atlas.groups.findIndex((g) => s.includes(g.name.toLowerCase()) || s.includes(g.short.toLowerCase()));
  if (i >= 0) return i;
  // Then the short label's first word on its own ("defense" for "Defense & security").
  const j = atlas.groups.findIndex((g) => {
    const w = g.short.toLowerCase().split(/[^a-z0-9]+/)[0];
    return w.length > 3 && new RegExp(`\\b${w}\\b`).test(s);
  });
  return j >= 0 ? j : null;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Every URL an item's record vouches for: its source record and its links. */
export const itemUrls = (it: Item) => [...(it.url ? [it.url] : []), ...it.links.map((l) => l.url)];

/** Compact view of an item for the model. */
export const itemBrief = (it: Item, atlas: Atlas) => ({
  id: it.id,
  name: it.name,
  summary: it.summary,
  description: it.description,
  facts: Object.fromEntries(atlas.facts.filter((f) => it.facts[f.key] !== undefined).map((f: FactSpec) => [f.label, formatFact(f, it.facts[f.key])])),
  group: it.group >= 0 ? atlas.groups[it.group].name : "Ungrouped",
  urls: itemUrls(it),
});

/** The atlas as seen through one filter value: the same map positions, fewer items, recounted groups. */
export function scopeTo(atlas: Atlas, value: string | null): Atlas {
  if (!value || !atlas.filter) return atlas;
  const key = atlas.filter.key;
  // Re-pack each group's spiral so a filtered cluster stays solid, at the same density as the full map.
  const spacing = 1.45 * Math.min(1.6, Math.max(0.6, Math.sqrt(230 / atlas.items.length)));
  const golden = Math.PI * (3 - Math.sqrt(5));
  const seen = new Map<number, number>();
  const items = atlas.items
    .filter((it) => it.facts[key] === value)
    .map((it) => {
      if (it.group < 0) return it;
      const k = seen.get(it.group) ?? 0;
      seen.set(it.group, k + 1);
      const [cx, cy] = atlas.groups[it.group].center;
      const r = spacing * Math.sqrt(k + 0.6);
      return { ...it, x: Math.round((cx + r * Math.cos(k * golden)) * 10) / 10, y: Math.round((cy + r * 1.6 * Math.sin(k * golden)) * 10) / 10 };
    });
  const groups = atlas.groups.map((g, i) => {
    const members = items.filter((it) => it.group === i);
    return { ...g, count: members.length, judgmentCalls: members.filter((m) => !m.evidence).length };
  });
  return { ...atlas, items, groups };
}

/** How a group's full-collection members split across the filter values. */
export function spread(atlas: Atlas, group: number): { value: string; count: number }[] {
  if (!atlas.filter) return [];
  const key = atlas.filter.key;
  return atlas.filter.values.map((value) => ({ value, count: atlas.items.filter((it) => it.group === group && it.facts[key] === value).length }));
}
