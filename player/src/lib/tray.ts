// What the viewer hands to their own Claude chat. Picks stack here; each hand-off
// sends the whole tray as one attachment (a newer one replaces the last).
import { itemUrls } from "../../shared/dataset";
import type { Atlas } from "../../shared/types";
import type { Json } from "./env";

export type Pick = { key: string; kind: "item" | "group" | "overview" | "answer"; name: string; detail: string; urls: string[] };

const LIMIT = 3900; // the platform's cap is 4 KiB of JSON

export const pickItem = (atlas: Atlas, id: string): Pick => {
  const it = atlas.items.find((x) => x.id === id)!;
  return { key: `item:${id}`, kind: "item", name: it.name, detail: it.summary, urls: itemUrls(it).slice(0, 2) };
};

export const pickGroup = (atlas: Atlas, g: number, scope: string | null): Pick => {
  const group = atlas.groups[g];
  const members = atlas.items.filter((it) => it.group === g);
  return {
    key: `group:${group.id}:${scope ?? "all"}`,
    kind: "group",
    name: `${group.name}${scope ? ` (${scope})` : ""}`,
    detail: `${members.length} ${atlas.noun[1]}: ${members.map((m) => m.name).join(", ")}`,
    urls: [],
  };
};

/** Plain-JSON payload for the chat, trimmed to fit: details shorten first, then the oldest picks drop. */
export function payload(atlas: Atlas, picks: Pick[], context: { page: string; scope: string | null }, question?: string): { [k: string]: Json } {
  const build = (ps: Pick[], max: number) => ({
    label: question ? question.slice(0, 120) : `${atlas.title}: ${ps.length} ${ps.length === 1 ? "pick" : "picks"}`,
    ...(question ? { question } : {}),
    atlas: atlas.title,
    source: `${atlas.source.name}, ${atlas.source.checked} (${atlas.source.url})`,
    viewing: context.page + (context.scope ? `, filtered to ${context.scope}` : ""),
    picks: ps.map((p) => ({ kind: p.kind, name: p.name, detail: p.detail.length > max ? p.detail.slice(0, max - 1) + "…" : p.detail, ...(p.urls.length ? { urls: p.urls } : {}) })),
    note: "From the atlas the viewer has open. Facts in it are as listed by the source on the date shown; anything else needs a cited web source.",
  });
  let ps = picks.slice(-15);
  for (const max of [600, 300, 160, 90]) {
    const out = build(ps, max);
    if (JSON.stringify(out).length <= LIMIT) return out;
  }
  while (ps.length > 1 && JSON.stringify(build(ps, 90)).length > LIMIT) ps = ps.slice(1);
  return build(ps, 90);
}

/** Outside Claude the same content travels as text. */
export function asText(data: { [k: string]: Json }): string {
  const picks = (data.picks as { name: string; detail: string; urls?: string[] }[]) ?? [];
  return [
    data.question ? `${data.question}\n` : "",
    `From the atlas "${data.atlas}" (${data.source}). Viewing: ${data.viewing}.`,
    ...picks.map((p, i) => `${i + 1}. ${p.name}: ${p.detail}${p.urls?.length ? ` ${p.urls.join(" ")}` : ""}`),
  ].join("\n");
}
