// Answer depths, cheapest first. Kept free of zod so the browser bundle stays small.
export const TIERS = ["tour", "dataset", "official", "web"] as const;
export type Tier = (typeof TIERS)[number];

export const TIER_INFO: Record<Tier | "agent", { name: string; hint: string }> = {
  tour: { name: "Tour", hint: "Pre-written from the snapshot. Instant." },
  dataset: { name: "Dataset", hint: "Queries the 230-company snapshot. Instant." },
  official: { name: "Official sources", hint: "Up to 3 fetches: YC profile, company site, SEC filings. About 10 s." },
  web: { name: "Web search", hint: "Up to 5 searches on an allowlist of reputable outlets. About 30 s. Asks first." },
  agent: { name: "Agent", hint: "Background research with no fixed budget. Lands in your notes." },
};
