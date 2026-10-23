// Turns typed input into an action. Whatever the atlas itself can answer is
// answered here, instantly; open questions go to the viewer's Claude, and
// questions about the outside world become research notes.
import type { Card } from "../../shared/card";
import { findGroupInText, findItemInText, groupMedian, inGroup, largest, median, numbers, placeCounts } from "../../shared/dataset";
import { factOf, placeKey, type Atlas, type FactSpec } from "../../shared/types";

export type Context = { group: number | null; item: string | null };

export type Action =
  | { kind: "next" }
  | { kind: "prev" }
  | { kind: "home" }
  | { kind: "group"; group: number }
  | { kind: "item"; id: string }
  | { kind: "note" }
  | { kind: "theme"; dark: boolean | null }
  | { kind: "card"; card: Card }
  /** Needs sources beyond the atlas: becomes a research note. */
  | { kind: "research" }
  /** An open question about what the atlas holds: the viewer's Claude answers. */
  | { kind: "ask" };

const words = (spec: FactSpec) => spec.label.toLowerCase().split(/\W+/).filter((w) => w.length > 2);

export function route(atlas: Atlas, input: string, ctx: Context): Action {
  const s = input.trim().toLowerCase().replace(/[?.!]+$/, "");
  const subject = subjectGroup(atlas, s, ctx);
  const num = factOf(atlas, "number");
  const place = factOf(atlas, "place");

  // Navigation and controls
  if (/^(next|skip|continue)( group| page)?$/.test(s)) return { kind: "next" };
  if (/^(back|previous|go back)$/.test(s)) return { kind: "prev" };
  if (/^(zoom out|overview|show (me )?everything|home|start)$/.test(s)) return { kind: "home" };
  if (/(dark|night) mode/.test(s)) return { kind: "theme", dark: true };
  if (/light mode/.test(s)) return { kind: "theme", dark: false };
  if (/^(note|save|add)\b|to (my )?notes/.test(s)) return { kind: "note" };

  // The outside world: news, money, anything past the source the atlas was built from
  if (/\b(news|press|coverage|search the web|web|research|funding|raised|investors?|valuation|revenue|customers|traction|latest|recent)\b/.test(s)) {
    return { kind: "research" };
  }

  if (num && (/\b(biggest|largest|most|top|highest|smallest)\b/.test(s) || words(num).some((w) => s.includes(w)))) {
    return { kind: "card", card: rankCard(atlas, subject, num) };
  }
  if (place) {
    const outside = input.trim().replace(/[?.!]+$/, "").match(/outside (?:of )?(.+)$/i);
    if (outside) return { kind: "card", card: outsideCard(atlas, subject, place, outside[1]) };
    if (/\b(where|based|located|locations?|cities|city|countries|country)\b/.test(s)) return { kind: "card", card: placeCard(atlas, subject, place) };
  }
  if (/^(.+ )?by group$/.test(s) && num) return { kind: "card", card: rankCard(atlas, null, num) };
  if (/\b(ungrouped|grey|gray|other)\b/.test(s)) return { kind: "card", card: ungroupedCard(atlas) };
  if (/how (were|are) (the )?groups|groups were drawn|method|classif|grouped/.test(s)) return { kind: "card", card: methodCard(atlas) };

  // Open questions go to Claude even when they name an item or group
  if (/^(compare|summari[sz]e|explain|why|how|what|which|who|tell me|describe|list)\b/.test(s)) return { kind: "ask" };

  // A group or item named outright means "take me there"
  const item = findItemInText(atlas, s);
  const group = findGroupInText(atlas, s);
  if (item && (group === null || item.name.length >= atlas.groups[group].short.length)) return { kind: "item", id: item.id };
  if (group !== null) return { kind: "group", group };
  return { kind: "ask" };
}

/** Instant answers from the atlas itself, for what's on screen. Each label routes to a card. */
export function quickFacts(atlas: Atlas, ctx: Context): { label: string; card: Card }[] {
  if (ctx.item) return [];
  const num = factOf(atlas, "number");
  const place = factOf(atlas, "place");
  const g = ctx.group !== null ? atlas.groups[ctx.group] : null;
  const labels: string[] = [];
  if (num) labels.push(g ? `Largest ${num.label.toLowerCase()}` : `${num.label} by group`);
  if (place) labels.push("Where they're based");
  if (!g) labels.push("Ungrouped", "How groups were drawn");
  return labels.flatMap((label) => {
    const a = route(atlas, label, ctx);
    return a.kind === "card" ? [{ label: label.replace(/\?$/, ""), card: a.card }] : [];
  });
}

/** Questions worth taking to Claude from here: comparisons and the outside world. */
export function questions(atlas: Atlas, ctx: Context, scope: string | null): string[] {
  const many = atlas.noun[1];
  if (ctx.item) {
    const name = atlas.items.find((it) => it.id === ctx.item)!.name;
    return [`What's the latest on ${name}, from official sources first?`, `Compare ${name} with the closest ${many} in its group.`];
  }
  if (ctx.group !== null) {
    const g = atlas.groups[ctx.group];
    const out = [`Compare the approaches in ${g.name.toLowerCase()}${scope ? ` (${scope})` : ""}.`, `What's the recent news on ${g.name.toLowerCase()} ${many}?`];
    if (atlas.filter && !scope) out[0] = `How does ${g.name.toLowerCase()} change across the ${atlas.filter.label.toLowerCase()}es?`;
    return out;
  }
  const out = [`Summarize each group in two lines, with examples.`];
  if (atlas.filter && !scope) out.push(`Which groups grow or shrink across the ${atlas.filter.label.toLowerCase()}es? Use the counts.`);
  else out.push(`Find ${many} working on a topic I name.`);
  return out;
}

function subjectGroup(atlas: Atlas, s: string, ctx: Context): number | null {
  if (/\b(all|overall|every|groups)\b/.test(s)) return null;
  return findGroupInText(atlas, s) ?? ctx.group;
}

const card = (c: Partial<Card> & Pick<Card, "summary">): Card => ({ blocks: [], sources: [], notStated: [], highlight: [], ...c });
const scopeName = (atlas: Atlas, group: number | null) => (group === null ? `all ${atlas.items.length} ${atlas.noun[1]}` : atlas.groups[group].name);

function rankCard(atlas: Atlas, group: number | null, f: FactSpec): Card {
  const label = f.label.toLowerCase();
  if (group !== null) {
    const top = largest(atlas, group, f.key);
    return card({
      summary: `Largest ${label} in ${atlas.groups[group].name}. The group median is ${groupMedian(atlas, group, f.key)}.`,
      blocks: [{ type: "bars", title: f.label, items: top.map((it) => ({ label: it.name, value: it.facts[f.key] as number, id: it.id })) }],
      highlight: top.map((it) => it.id),
    });
  }
  const top = largest(atlas, null, f.key, 1)[0];
  const byGroup = atlas.groups.map((g, i) => ({ label: g.short, value: groupMedian(atlas, i, f.key) })).sort((a, b) => b.value - a.value);
  const listed = numbers(atlas.items, f.key).length;
  return card({
    summary: `The median ${label} across ${scopeName(atlas, null)} is ${median(numbers(atlas.items, f.key))}. ${byGroup[0].label} has the highest group median, ${byGroup[0].value}.${top ? ` ${top.name} lists ${top.facts[f.key]}, the most of any.` : ""}`,
    blocks: [
      { type: "bars", title: `Median ${label} by group`, items: byGroup },
      ...(listed < atlas.items.length ? [{ type: "text" as const, text: `${atlas.items.length - listed} ${atlas.noun[1]} don't list a ${label} and are left out.` }] : []),
    ],
  });
}

function placeCard(atlas: Atlas, group: number | null, f: FactSpec): Card {
  const counts = placeCounts(atlas, group, f.key).slice(0, 6);
  const total = inGroup(atlas, group).length;
  return card({
    summary: `${counts[0][1]} of ${total} in ${scopeName(atlas, group)} list ${counts[0][0]} as their ${f.label.toLowerCase()}.`,
    blocks: [{ type: "bars", title: `${f.label}, top ${counts.length}`, items: counts.map(([label, value]) => ({ label, value })) }],
  });
}

function outsideCard(atlas: Atlas, group: number | null, f: FactSpec, where: string): Card {
  const all = inGroup(atlas, group);
  const w = where.trim().toLowerCase();
  const xs = all.filter((it) => it.facts[f.key] !== undefined && !String(it.facts[f.key]).toLowerCase().includes(w));
  return card({
    summary: `${xs.length} of ${all.length} in ${scopeName(atlas, group)} list a ${f.label.toLowerCase()} outside ${where.trim()}.`,
    blocks: [{ type: "items", items: xs.slice(0, 24).map((it) => ({ id: it.id, note: placeKey(it.facts[f.key]) })) }],
    highlight: xs.map((it) => it.id),
  });
}

function ungroupedCard(atlas: Atlas): Card {
  const xs = atlas.items.filter((it) => it.group < 0);
  return card({
    summary: `${xs.length} ${atlas.noun[1]} don't share a clear group with others. They're highlighted on the map.`,
    blocks: [{ type: "items", title: "A few of them", items: xs.slice(0, 8).map((it) => ({ id: it.id })) }],
    highlight: xs.map((it) => it.id),
  });
}

function methodCard(atlas: Atlas): Card {
  const grouped = atlas.items.filter((it) => it.group >= 0);
  const calls = grouped.filter((it) => !it.evidence).length;
  return card({
    summary: `${atlas.method} ${grouped.length - calls} of ${grouped.length} placements quote a supporting phrase; ${calls} are marked as judgment calls.`,
    blocks: [{ type: "facts", items: atlas.groups.map((g) => ({ label: g.short, value: g.rubric })) }],
  });
}
