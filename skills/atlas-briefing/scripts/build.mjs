#!/usr/bin/env node
// Atlas Briefing builder. Zero dependencies: Node 18+ only.
//
//   node build.mjs <collection.json> [--out <file.html>] [--template <player.html>] [--check]
//
// Validates a collection, lays out the map, and writes one self-contained HTML
// page (the prebuilt player with the data inlined) ready to publish as a Claude
// artifact. Errors stop the build; warnings are printed and the build goes on.
// The format is documented in ../references/collection-format.md.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_TEMPLATE = join(HERE, "../assets/player.html");
const DATA_SLOT = "/*ATLAS_DATA*/";
const TITLE_SLOT = "<title>Atlas Briefing</title>";

/**
 * Collection (authored) -> Atlas (what the player renders).
 * Throws with every error at once; returns warnings alongside the atlas.
 */
export function buildAtlas(collection) {
  const errors = [];
  const warnings = [];
  const c = collection ?? {};
  const need = (cond, msg) => cond || errors.push(msg);

  need(nonEmpty(c.title), "title is required");
  need(nonEmpty(c.overview), "overview is required");
  need(Array.isArray(c.noun) && c.noun.length === 2 && c.noun.every(nonEmpty), 'noun must be ["singular", "plural"], e.g. ["company", "companies"]');
  need(c.source && nonEmpty(c.source.name) && isUrl(c.source.url) && nonEmpty(c.source.checked), "source needs name, url (http/https) and checked (the date you read it)");
  need(nonEmpty(c.method), "method is required: one sentence on how items were grouped");

  const facts = Array.isArray(c.facts) ? c.facts : [];
  const factKeys = new Set();
  for (const f of facts) {
    need(nonEmpty(f.key) && nonEmpty(f.label), `fact spec needs key and label: ${JSON.stringify(f)}`);
    need(["number", "place", "text"].includes(f.type), `fact ${f.key}: type must be number, place or text`);
    need(!factKeys.has(f.key), `fact ${f.key} is declared twice`);
    factKeys.add(f.key);
  }

  const rawGroups = Array.isArray(c.groups) ? c.groups : [];
  need(rawGroups.length > 0, "at least one group is required");
  if (rawGroups.length > 10) warnings.push(`${rawGroups.length} groups is a lot for one screen; 4 to 8 reads best`);
  const groupIndex = new Map();
  rawGroups.forEach((g, i) => {
    need(nonEmpty(g.id) && nonEmpty(g.name) && nonEmpty(g.short) && nonEmpty(g.rubric) && nonEmpty(g.narration), `group ${i}: id, name, short, rubric and narration are required`);
    need(!groupIndex.has(g.id), `group id ${g.id} is used twice`);
    if (nonEmpty(g.short) && g.short.length > 18) warnings.push(`group ${g.id}: short label "${g.short}" is long for a map label (18 characters or fewer)`);
    if (g.center !== undefined) need(Array.isArray(g.center) && g.center.length === 2 && g.center.every((n) => n >= 5 && n <= 95), `group ${g.id}: center must be [x, y] between 5 and 95`);
    groupIndex.set(g.id, i);
  });

  const rawItems = Array.isArray(c.items) ? c.items : [];
  need(rawItems.length > 0, "items is empty");
  if (rawItems.length > 600) warnings.push(`${rawItems.length} items: the map gets crowded past about 600`);
  const ids = new Set();
  const items = rawItems.map((it, n) => {
    const where = `item ${it?.id ?? n}`;
    need(nonEmpty(it.id), `item ${n}: id is required`);
    need(!ids.has(it.id), `${where}: duplicate id`);
    ids.add(it.id);
    need(nonEmpty(it.name), `${where}: name is required`);
    need(nonEmpty(it.summary), `${where}: summary is required`);
    if (it.url != null) need(isUrl(it.url), `${where}: url must be http(s)`);
    const links = Array.isArray(it.links) ? it.links : [];
    for (const l of links) need(nonEmpty(l.label) && isUrl(l.url), `${where}: each link needs label and an http(s) url`);

    const values = {};
    for (const [k, v] of Object.entries(it.facts ?? {})) {
      const spec = facts.find((f) => f.key === k);
      if (!spec) {
        warnings.push(`${where}: fact "${k}" is not declared in facts, ignored`);
        continue;
      }
      if (v === null || v === "") continue;
      if (spec.type === "number") need(typeof v === "number" && Number.isFinite(v), `${where}: fact ${k} must be a number or null`);
      else need(typeof v === "string", `${where}: fact ${k} must be a string or null`);
      values[k] = v;
    }

    let group = -1;
    if (it.group != null) {
      need(groupIndex.has(it.group), `${where}: unknown group "${it.group}"`);
      group = groupIndex.get(it.group) ?? -1;
    }
    const summary = String(it.summary ?? "").trim();
    let evidence = null;
    if (nonEmpty(it.evidence)) {
      if (group < 0) warnings.push(`${where}: evidence given but no group, ignored`);
      else {
        evidence = locate(summary, it.evidence);
        need(evidence !== null, `${where}: evidence "${it.evidence}" is not in its summary. Quote the summary exactly, or set evidence to null to mark a judgment call.`);
      }
    }
    return {
      id: String(it.id),
      name: String(it.name ?? "").trim(),
      summary,
      description: String(it.description ?? "").trim(),
      url: it.url ?? null,
      links,
      facts: values,
      tags: Array.isArray(it.tags) ? it.tags.map(String) : [],
      group,
      evidence,
      x: 0,
      y: 0,
    };
  });

  const groups = rawGroups.map((g, i) => {
    const members = items.filter((it) => it.group === i);
    if (!members.length) warnings.push(`group ${g.id} has no items`);
    // A narration that opens with a number is a count claim; it must be true.
    const stated = String(g.narration ?? "").match(/^(\d+)\b/);
    if (stated) need(Number(stated[1]) === members.length, `group ${g.id}: narration says ${stated[1]}, data has ${members.length}`);
    return {
      id: g.id,
      name: g.name,
      short: g.short,
      rubric: g.rubric,
      narration: g.narration,
      center: g.center ?? null,
      count: members.length,
      judgmentCalls: members.filter((m) => !m.evidence).length,
    };
  });

  // Every number in the overview must be a count the data supports (years aside).
  const grouped = items.filter((it) => it.group >= 0).length;
  const allowed = new Set([items.length, grouped, items.length - grouped, groups.length, ...groups.map((g) => g.count)]);
  for (const m of String(c.overview ?? "").matchAll(/\b\d[\d,]*\b/g)) {
    const n = Number(m[0].replace(/,/g, ""));
    if (n >= 1900 && n <= 2100) continue;
    need(allowed.has(n), `overview states ${m[0]}, which matches no count in the data (total ${items.length}, grouped ${grouped}, ungrouped ${items.length - grouped})`);
  }

  if (errors.length) {
    const err = new Error(`Collection has ${errors.length} error(s):\n- ${errors.join("\n- ")}`);
    err.errors = errors;
    err.warnings = warnings;
    throw err;
  }

  layout(items, groups);
  const atlas = {
    title: c.title.trim(),
    noun: c.noun,
    source: c.source,
    method: c.method.trim(),
    overview: c.overview.trim(),
    facts: facts.map(({ key, label, type, unit }) => ({ key, label, type, ...(unit ? { unit } : {}) })),
    groups,
    items,
  };
  return { atlas, warnings };
}

/** [start, end) of quote inside text, case-insensitively; null when absent. */
export function locate(text, quote) {
  const q = String(quote ?? "").trim();
  if (!q) return null;
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  return i < 0 ? null : [i, i + q.length];
}

/** Inline the atlas into the player template. */
export function renderPage(template, atlas) {
  if (!template.includes(DATA_SLOT)) throw new Error("Template has no data slot. Rebuild the player (npm run release in player/).");
  // "<" escaped so no string in the data can close the script element.
  const json = JSON.stringify(atlas).replace(/</g, "\\u003c");
  return template.replace(DATA_SLOT, () => json).replace(TITLE_SLOT, () => `<title>${escapeHtml(atlas.title)}</title>`);
}

/** Group clusters as sunflower spirals; ungrouped items scattered clear of them. Deterministic. */
function layout(items, groups) {
  const golden = Math.PI * (3 - Math.sqrt(5));
  const ASPECT = 1.6; // the map is 16:10, so stretch y to keep clusters round
  const spacing = 1.45 * Math.min(1.6, Math.max(0.6, Math.sqrt(230 / items.length)));
  const n = groups.length;
  groups.forEach((g, i) => {
    if (!g.center) {
      // Evenly around an ellipse, leaving the middle for ungrouped items.
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
      g.center = [round(50 + 34 * Math.cos(a)), round(52 + 30 * Math.sin(a))];
    }
    items
      .filter((it) => it.group === i)
      .forEach((it, k) => {
        const r = spacing * Math.sqrt(k + 0.6);
        it.x = clamp(round(g.center[0] + r * Math.cos(k * golden)));
        it.y = clamp(round(g.center[1] + r * ASPECT * Math.sin(k * golden)));
      });
  });
  const rand = mulberry32(7);
  const placed = items.filter((it) => it.group >= 0);
  for (const it of items.filter((x) => x.group < 0)) {
    for (let attempt = 0; attempt < 5000; attempt++) {
      const x = 4 + rand() * 92;
      const y = 6 + rand() * 88;
      const clear =
        groups.every((g) => Math.hypot(x - g.center[0], (y - g.center[1]) / ASPECT) > 10) &&
        placed.every((p) => Math.hypot(x - p.x, (y - p.y) / ASPECT) > spacing * 1.5);
      if (clear || attempt === 4999) {
        it.x = round(x);
        it.y = round(y);
        placed.push(it);
        break;
      }
    }
  }
}

const nonEmpty = (s) => typeof s === "string" && s.trim().length > 0;
const isUrl = (s) => typeof s === "string" && /^https?:\/\/\S+$/.test(s);
const round = (v) => Math.round(v * 10) / 10;
const clamp = (v) => Math.max(1, Math.min(99, v));
const escapeHtml = (s) => s.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]);

function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function main(argv) {
  const args = argv.slice(2);
  const flag = (name) => {
    const i = args.indexOf(name);
    return i >= 0 ? args.splice(i, 2)[1] : undefined;
  };
  const check = args.includes("--check");
  const out = flag("--out");
  const template = flag("--template") ?? DEFAULT_TEMPLATE;
  const input = args.find((a) => !a.startsWith("--"));
  if (!input) {
    console.error("usage: node build.mjs <collection.json> [--out <file.html>] [--template <player.html>] [--check]");
    process.exit(2);
  }
  let result;
  try {
    result = buildAtlas(JSON.parse(readFileSync(input, "utf8")));
  } catch (e) {
    console.error(e.message);
    for (const w of e.warnings ?? []) console.error(`warning: ${w}`);
    process.exit(1);
  }
  const { atlas, warnings } = result;
  for (const w of warnings) console.warn(`warning: ${w}`);
  const grouped = atlas.items.filter((it) => it.group >= 0);
  const calls = grouped.filter((it) => !it.evidence).length;
  console.log(`ok: ${atlas.items.length} ${atlas.noun[1]}, ${grouped.length} in ${atlas.groups.length} groups (${calls} judgment calls), ${atlas.items.length - grouped.length} ungrouped`);
  if (check) return;
  const dest = resolve(out ?? join(dirname(input), "atlas.html"));
  const page = renderPage(readFileSync(template, "utf8"), atlas);
  writeFileSync(dest, page);
  console.log(`wrote ${dest} (${Math.round(page.length / 1024)} KB)`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv);
