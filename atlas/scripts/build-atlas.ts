// Builds shared/atlas.generated.json from the YC snapshot, the group definitions
// and the per-company assignments. Fails loudly if the data disagrees with itself.
import { readFileSync, writeFileSync } from "node:fs";
import { median } from "../shared/dataset";
import type { Atlas, Company, Group } from "../shared/types";

type Raw = {
  batch: string;
  checked: string;
  source: string;
  companies: {
    slug: string;
    name: string;
    one_liner: string;
    description?: string;
    team_size: number | null;
    all_locations: string | null;
    website: string | null;
    founders: { name: string }[];
    tags: string[];
    industry: string;
  }[];
};
type GroupsFile = { overview: string; groups: Omit<Group, "count" | "medianTeam" | "judgmentCalls">[] };
type AssignmentsFile = { method: string; assignments: Record<string, { group: number; evidence: [number, number] | null }> };

const read = <T>(p: string): T => JSON.parse(readFileSync(new URL(p, import.meta.url), "utf8"));

export function buildAtlas(raw: Raw, groupsFile: GroupsFile, assignmentsFile: AssignmentsFile): Atlas {
  const errors: string[] = [];
  const bySlug = new Map(raw.companies.map((c) => [c.slug, c]));
  for (const slug of Object.keys(assignmentsFile.assignments)) {
    if (!bySlug.has(slug)) errors.push(`assignment for unknown company: ${slug}`);
  }

  const companies: Company[] = raw.companies.map((c) => {
    const a = assignmentsFile.assignments[c.slug];
    const oneLiner = c.one_liner.trim();
    const group = a ? a.group : -1;
    if (a && (a.group < 0 || a.group >= groupsFile.groups.length)) errors.push(`${c.slug}: bad group ${a.group}`);
    const evidence = a?.evidence ?? null;
    if (evidence && !(evidence[0] >= 0 && evidence[1] > evidence[0] && evidence[1] <= oneLiner.length)) {
      errors.push(`${c.slug}: evidence span ${evidence} outside one-liner`);
    }
    const location = (c.all_locations ?? "").split(";")[0].trim();
    return {
      slug: c.slug,
      name: c.name,
      oneLiner,
      description: (c.description ?? "").trim(),
      teamSize: c.team_size && c.team_size > 0 ? c.team_size : null,
      location: location || "Not listed",
      city: location ? location.split(",")[0].trim() : "Not listed",
      website: c.website,
      founders: c.founders.map((f) => f.name),
      tags: c.tags,
      ycIndustry: c.industry,
      group,
      evidence,
      x: 0,
      y: 0,
    };
  });

  const groups: Group[] = groupsFile.groups.map((g, i) => {
    const members = companies.filter((c) => c.group === i);
    const stated = Number(g.narration.match(/^(\d+)/)?.[1]);
    if (stated !== members.length) errors.push(`${g.id}: narration says ${stated}, data has ${members.length}`);
    return {
      ...g,
      count: members.length,
      medianTeam: median(members.map((c) => c.teamSize ?? 0)),
      judgmentCalls: members.filter((c) => !c.evidence).length,
    };
  });

  const grouped = companies.filter((c) => c.group >= 0).length;
  const statedGrouped = Number(groupsFile.overview.match(/(\d+) fall into/)?.[1]);
  if (statedGrouped !== grouped) errors.push(`overview says ${statedGrouped} grouped, data has ${grouped}`);
  if (errors.length) throw new Error("Atlas data is inconsistent:\n" + errors.join("\n"));

  layout(companies, groups);
  return {
    batch: raw.batch,
    snapshotDate: raw.checked,
    source: raw.source,
    classification: assignmentsFile.method,
    overview: groupsFile.overview,
    groups,
    companies,
  };
}

/** Sunflower spiral per group around its center; ungrouped companies scattered away from the clusters. */
function layout(companies: Company[], groups: Group[]) {
  const golden = Math.PI * (3 - Math.sqrt(5));
  const ASPECT = 1.6; // map is 16:10, so stretch y to keep clusters round
  groups.forEach((g, gi) => {
    companies
      .filter((c) => c.group === gi)
      .forEach((c, i) => {
        const r = 1.45 * Math.sqrt(i + 0.6);
        c.x = round(g.center[0] + r * Math.cos(i * golden));
        c.y = round(g.center[1] + r * ASPECT * Math.sin(i * golden));
      });
  });
  const rand = mulberry32(7);
  const placed = companies.filter((c) => c.group >= 0);
  for (const c of companies.filter((c) => c.group < 0)) {
    for (let attempt = 0; attempt < 5000; attempt++) {
      const x = 4 + rand() * 92;
      const y = 6 + rand() * 88;
      const clear =
        groups.every((g) => Math.hypot(x - g.center[0], (y - g.center[1]) / ASPECT) > 10) &&
        placed.every((p) => Math.hypot(x - p.x, (y - p.y) / ASPECT) > 2.2);
      if (clear || attempt === 4999) {
        c.x = round(x);
        c.y = round(y);
        placed.push(c);
        break;
      }
    }
  }
}

const round = (n: number) => Math.round(n * 10) / 10;

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const atlas = buildAtlas(
    read<Raw>("../data/yc-s26-snapshot.json"),
    read<GroupsFile>("../data/groups.json"),
    read<AssignmentsFile>("../data/assignments.json"),
  );
  writeFileSync(new URL("../shared/atlas.generated.json", import.meta.url), JSON.stringify(atlas));
  const grouped = atlas.companies.filter((c) => c.group >= 0).length;
  console.log(`atlas: ${atlas.companies.length} companies, ${grouped} grouped, ${atlas.groups.length} groups`);
}
