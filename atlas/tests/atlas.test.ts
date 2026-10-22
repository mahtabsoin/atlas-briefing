import { describe, expect, it } from "vitest";
import atlasJson from "../shared/atlas.generated.json";
import type { Atlas } from "../shared/types";
import { locate } from "../scripts/classify";

const atlas = atlasJson as Atlas;

describe("generated atlas", () => {
  it("covers every company in the snapshot exactly once", () => {
    const slugs = atlas.companies.map((c) => c.slug);
    expect(slugs.length).toBe(230);
    expect(new Set(slugs).size).toBe(230);
  });

  it("has a real supporting phrase wherever a placement claims one", () => {
    for (const c of atlas.companies.filter((c) => c.evidence)) {
      const [a, b] = c.evidence!;
      const phrase = c.oneLiner.slice(a, b);
      expect(phrase.trim().length, c.slug).toBeGreaterThan(1);
      expect(c.group, c.slug).toBeGreaterThanOrEqual(0);
    }
  });

  it("keeps group counts, narration and stats in agreement", () => {
    for (const [i, g] of atlas.groups.entries()) {
      const members = atlas.companies.filter((c) => c.group === i);
      expect(g.count).toBe(members.length);
      expect(g.narration.startsWith(String(members.length))).toBe(true);
      expect(g.judgmentCalls).toBe(members.filter((c) => !c.evidence).length);
    }
  });

  it("places every dot inside the map", () => {
    for (const c of atlas.companies) {
      expect(c.x, c.slug).toBeGreaterThan(0);
      expect(c.x, c.slug).toBeLessThan(100);
      expect(c.y, c.slug).toBeGreaterThan(0);
      expect(c.y, c.slug).toBeLessThan(100);
    }
  });

  it("names only companies that exist in each group's narration examples", () => {
    const names = atlas.companies.map((c) => c.name.toLowerCase());
    const checks: [string, string][] = [
      ["service-firms", "billow"],
      ["agent-infra", "agentcard"],
      ["defense", "isengard"],
      ["bio", "tarebio"],
    ];
    for (const [id, word] of checks) {
      const g = atlas.groups.find((x) => x.id === id)!;
      expect(g.narration.toLowerCase()).toContain(word);
      expect(names.some((n) => n.startsWith(word))).toBe(true);
    }
    const isengard = atlas.companies.find((c) => c.slug === "isengard-industries-inc")!;
    expect(isengard.teamSize).toBe(Math.max(...atlas.companies.map((c) => c.teamSize ?? 0)));
  });
});

describe("classification evidence", () => {
  it("only accepts quotes that appear verbatim in the one-liner", () => {
    expect(locate("AI-native accounting firm.", "accounting firm")).toEqual([10, 25]);
    expect(locate("AI-native accounting firm.", "Accounting Firm")).toEqual([10, 25]);
    expect(locate("AI-native accounting firm.", "law firm")).toBeNull();
    expect(locate("AI-native accounting firm.", "")).toBeNull();
  });
});
