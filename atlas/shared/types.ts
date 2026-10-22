// Data model shared by the client, the server and the build scripts.

export type Company = {
  slug: string;
  name: string;
  oneLiner: string;
  description: string;
  teamSize: number | null;
  location: string;
  city: string;
  website: string | null;
  founders: string[];
  tags: string[];
  ycIndustry: string;
  /** Index into Atlas.groups, or -1 when ungrouped. */
  group: number;
  /** [start, end) span in oneLiner that supports the group, or null for a judgment call. */
  evidence: [number, number] | null;
  x: number;
  y: number;
};

export type Group = {
  id: string;
  name: string;
  short: string;
  center: [number, number];
  rubric: string;
  narration: string;
  count: number;
  medianTeam: number;
  judgmentCalls: number;
};

export type Atlas = {
  batch: string;
  snapshotDate: string;
  source: string;
  classification: string;
  overview: string;
  groups: Group[];
  companies: Company[];
};

export const ycProfileUrl = (slug: string) => `https://www.ycombinator.com/companies/${slug}`;
