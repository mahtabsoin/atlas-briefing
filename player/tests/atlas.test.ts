import { describe, expect, it } from "vitest";
import { buildAtlas, locate, renderPage } from "../../skills/atlas-briefing/scripts/build.mjs";
import { scopeTo, spread } from "../shared/dataset";
import { yc, ycCollection } from "./fixture";

const atlas = yc();

describe("YC 2026 example atlas", () => {
  it("covers every company exactly once", () => {
    const ids = atlas.items.map((it) => it.id);
    expect(ids.length).toBe(788);
    expect(new Set(ids).size).toBe(788);
  });

  it("has a real supporting phrase wherever a placement claims one", () => {
    for (const it of atlas.items.filter((x) => x.evidence)) {
      const [a, b] = it.evidence!;
      expect(it.summary.slice(a, b).trim().length, it.id).toBeGreaterThan(1);
      expect(it.group, it.id).toBeGreaterThanOrEqual(0);
    }
    expect(atlas.items.filter((x) => x.group >= 0 && !x.evidence).length).toBe(1);
  });

  it("keeps group counts and narration in agreement", () => {
    for (const [i, g] of atlas.groups.entries()) {
      const members = atlas.items.filter((it) => it.group === i);
      expect(g.count).toBe(members.length);
      expect(g.narration.startsWith(String(members.length))).toBe(true);
    }
  });

  it("places every dot inside the map", () => {
    for (const it of atlas.items) {
      expect(it.x, it.id).toBeGreaterThan(0);
      expect(it.x, it.id).toBeLessThan(100);
      expect(it.y, it.id).toBeGreaterThan(0);
      expect(it.y, it.id).toBeLessThan(100);
    }
  });
});

describe("batch filter", () => {
  it("splits every company into exactly one of the four batches", () => {
    expect(atlas.filter?.values).toEqual(["Winter 2026", "Spring 2026", "Summer 2026", "Fall 2026"]);
    const counts = atlas.filter!.values.map((v) => scopeTo(atlas, v).items.length);
    expect(counts).toEqual([197, 193, 230, 168]);
  });

  it("recounts groups when scoped, and the spread adds up to the full count", () => {
    const summer = scopeTo(atlas, "Summer 2026");
    const sf = atlas.groups.findIndex((g) => g.id === "service-firms");
    expect(summer.groups[sf].count).toBe(20);
    expect(spread(atlas, sf).reduce((n, s) => n + s.count, 0)).toBe(atlas.groups[sf].count);
    expect(scopeTo(atlas, null)).toBe(atlas);
  });

  it("rejects a filter value the collection doesn't declare", () => {
    const c = ycCollection();
    c.items[0].facts.batch = "Winter 2025";
    expect(() => buildAtlas(c)).toThrow(/not one of filter.values/);
  });
});

describe("builder checks", () => {
  const tiny = () => ({
    title: "Tiny",
    noun: ["thing", "things"],
    source: { name: "Registry", url: "https://example.org", checked: "2026-10-22" },
    method: "By what each says it does.",
    overview: "3 things. 2 fall into one group.",
    facts: [{ key: "size", label: "Size", type: "number" }],
    groups: [{ id: "a", name: "Alpha", short: "Alpha", rubric: "Says alpha.", narration: "2 things say alpha." }],
    items: [
      { id: "x", name: "X", summary: "An alpha tool.", group: "a", evidence: "alpha tool", facts: { size: 3 } },
      { id: "y", name: "Y", summary: "Alpha, sort of.", group: "a", evidence: null },
      { id: "z", name: "Z", summary: "Something else." },
    ],
  });

  it("builds a small collection and lays out groups without centers", () => {
    const { atlas: a } = buildAtlas(tiny());
    expect(a.groups[0].center).toHaveLength(2);
    expect(a.items[0].evidence).toEqual([3, 13]);
    expect(a.groups[0].judgmentCalls).toBe(1);
  });

  it("rejects evidence that isn't quoted from the summary", () => {
    const c = tiny();
    c.items[0].evidence = "beta tool";
    expect(() => buildAtlas(c)).toThrow(/not in its summary/);
  });

  it("rejects counts the data doesn't support", () => {
    const c = tiny();
    c.groups[0].narration = "5 things say alpha.";
    c.overview = "4 things.";
    expect(() => buildAtlas(c)).toThrow(/narration says 5[\s\S]*overview states 4/);
  });

  it("rejects unknown groups and duplicate ids", () => {
    const c = tiny();
    c.items[2] = { ...c.items[1], group: "nope" } as never;
    expect(() => buildAtlas(c)).toThrow(/duplicate id[\s\S]*unknown group/);
  });

  it("locates quotes case-insensitively and only when present", () => {
    expect(locate("AI-native accounting firm.", "Accounting Firm")).toEqual([10, 25]);
    expect(locate("AI-native accounting firm.", "law firm")).toBeNull();
    expect(locate("AI-native accounting firm.", "")).toBeNull();
  });

  it("inlines data so no string can close the script element", () => {
    const c = ycCollection();
    c.items[0].description = "</script><script>alert(1)</script>";
    const html = renderPage('<title>Atlas Briefing</title><script type="application/json" id="atlas-data">/*ATLAS_DATA*/</script>', buildAtlas(c).atlas);
    expect(html).not.toContain("</script><script>alert");
    expect(html).toContain("<title>YC 2026</title>");
  });
});
