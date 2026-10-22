// Deterministic queries over the snapshot. Used by the instant "Dataset" tier
// in the browser and exposed to the model as tools on the server.
import type { Atlas, Company } from "./types";

export const median = (values: number[]): number => {
  const xs = values.filter((v) => v > 0).sort((a, b) => a - b);
  if (!xs.length) return 0;
  const m = Math.floor(xs.length / 2);
  return xs.length % 2 ? xs[m] : (xs[m - 1] + xs[m]) / 2;
};

export const inGroup = (atlas: Atlas, group: number | null): Company[] =>
  group === null ? atlas.companies : atlas.companies.filter((c) => c.group === group);

export const bySlug = (atlas: Atlas, slug: string): Company | undefined =>
  atlas.companies.find((c) => c.slug === slug);

export type SearchParams = {
  query?: string;
  group?: number | null;
  location?: string;
  maxTeam?: number;
  limit?: number;
};

export function searchCompanies(atlas: Atlas, p: SearchParams): { total: number; companies: Company[] } {
  const terms = (p.query ?? "").toLowerCase().split(/\s+/).filter(Boolean);
  let xs = inGroup(atlas, p.group ?? null);
  if (terms.length) {
    xs = xs.filter((c) => {
      const hay = [c.name, c.oneLiner, c.description, c.location, c.ycIndustry, ...c.tags, ...c.founders]
        .join(" ")
        .toLowerCase();
      return terms.every((t) => hay.includes(t));
    });
  }
  if (p.location) {
    const loc = p.location.toLowerCase();
    xs = xs.filter((c) => c.location.toLowerCase().includes(loc));
  }
  if (p.maxTeam) xs = xs.filter((c) => c.teamSize !== null && c.teamSize <= p.maxTeam!);
  const limit = Math.max(1, Math.min(20, p.limit ?? 10));
  return { total: xs.length, companies: xs.slice(0, limit) };
}

export function largestTeams(atlas: Atlas, group: number | null, n = 6): Company[] {
  return inGroup(atlas, group)
    .filter((c) => c.teamSize)
    .sort((a, b) => (b.teamSize ?? 0) - (a.teamSize ?? 0))
    .slice(0, n);
}

export function cityCounts(atlas: Atlas, group: number | null): [string, number][] {
  const counts = new Map<string, number>();
  for (const c of inGroup(atlas, group)) counts.set(c.city, (counts.get(c.city) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

/** Longest company name contained in the text, so "Palisade" doesn't shadow a longer match. */
export function findCompanyInText(atlas: Atlas, text: string): Company | undefined {
  const s = ` ${text.toLowerCase()} `;
  return atlas.companies
    .filter((c) => c.name.length > 2 && new RegExp(`[^a-z0-9]${escapeRe(c.name.toLowerCase())}[^a-z0-9]`).test(s))
    .sort((a, b) => b.name.length - a.name.length)[0];
}

export function findGroupInText(atlas: Atlas, text: string): number | null {
  const s = text.toLowerCase();
  const i = atlas.groups.findIndex((g) => s.includes(g.name.toLowerCase()) || s.includes(g.short.toLowerCase()));
  return i >= 0 ? i : null;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Compact view of a company for model context and tool results. */
export const companyBrief = (c: Company, atlas: Atlas) => ({
  slug: c.slug,
  name: c.name,
  one_liner: c.oneLiner,
  description: c.description,
  team_size: c.teamSize,
  location: c.location,
  website: c.website,
  founders: c.founders,
  group: c.group >= 0 ? atlas.groups[c.group].name : "Ungrouped",
  yc_profile: `https://www.ycombinator.com/companies/${c.slug}`,
});
