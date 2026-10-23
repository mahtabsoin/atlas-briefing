// The Atlas the player renders. Produced by skills/atlas-briefing/scripts/build.mjs
// from a collection.json (format: skills/atlas-briefing/references/collection-format.md).

export type FactSpec = {
  key: string;
  label: string;
  /** number: rankable (bars, medians). place: countable (where). text: shown only. */
  type: "number" | "place" | "text";
  unit?: string;
};

export type FactValue = string | number;

export type Item = {
  id: string;
  name: string;
  /** One line from the official source. Grouping evidence is quoted from it. */
  summary: string;
  description: string;
  /** The item's record at the official source. */
  url: string | null;
  links: { label: string; url: string }[];
  facts: Record<string, FactValue>;
  tags: string[];
  /** Index into Atlas.groups, or -1 when ungrouped. */
  group: number;
  /** [start, end) span of summary that supports the group, or null for a judgment call. */
  evidence: [number, number] | null;
  x: number;
  y: number;
};

export type Group = {
  id: string;
  name: string;
  short: string;
  rubric: string;
  narration: string;
  center: [number, number];
  count: number;
  judgmentCalls: number;
};

export type Atlas = {
  title: string;
  noun: [string, string];
  source: { name: string; url: string; checked: string };
  method: string;
  overview: string;
  facts: FactSpec[];
  /** A text fact the viewer can narrow everything by (e.g. batch), with its values in order. */
  filter?: { key: string; label: string; values: string[] };
  groups: Group[];
  items: Item[];
};

/** The first fact of a type, which the instant answers rank or count by. */
export const factOf = (atlas: Atlas, type: FactSpec["type"]) => atlas.facts.find((f) => f.type === type) ?? null;

export const formatFact = (spec: FactSpec, v: FactValue | undefined) =>
  v === undefined ? "Not listed" : typeof v === "number" && spec.unit ? `${v} ${spec.unit}` : String(v);

/** First segment of a place ("San Francisco, CA, USA" -> "San Francisco"). */
export const placeKey = (v: FactValue | undefined) => (v === undefined ? "Not listed" : String(v).split(",")[0].trim() || "Not listed");
