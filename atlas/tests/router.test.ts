import { describe, expect, it } from "vitest";
import atlasJson from "../shared/atlas.generated.json";
import type { Atlas } from "../shared/types";
import { route, suggestions, type Context } from "../src/lib/router";

const atlas = atlasJson as Atlas;
const overview: Context = { group: null, company: null };
const defense = atlas.groups.findIndex((g) => g.id === "defense");
const inDefense: Context = { group: defense, company: null };

describe("router", () => {
  it("handles spoken controls", () => {
    expect(route(atlas, "next", overview)).toEqual({ kind: "next" });
    expect(route(atlas, "continue", overview)).toEqual({ kind: "next" });
    expect(route(atlas, "zoom out", inDefense)).toEqual({ kind: "home" });
    expect(route(atlas, "add this to my notes", inDefense)).toEqual({ kind: "pin" });
    expect(route(atlas, "switch to dark mode", overview)).toEqual({ kind: "theme", dark: true });
  });

  it("navigates to named groups and companies", () => {
    expect(route(atlas, "take me to defense", overview)).toEqual({ kind: "group", group: defense });
    expect(route(atlas, "Robotics", overview)).toMatchObject({ kind: "group" });
    expect(route(atlas, "open Isengard Industries Inc", overview)).toEqual({ kind: "company", slug: "isengard-industries-inc" });
  });

  it("answers team questions from the snapshot for the group on screen", () => {
    const a = route(atlas, "Largest teams in Defense", overview);
    expect(a.kind).toBe("card");
    if (a.kind !== "card") return;
    expect(a.card.tier).toBe("dataset");
    const bars = a.card.blocks[0];
    expect(bars.type).toBe("bars");
    if (bars.type === "bars") expect(bars.items[0].label).toBe("Isengard Industries Inc");
  });

  it("answers batch-wide team questions with group medians", () => {
    const a = route(atlas, "Which groups have the biggest teams?", inDefense);
    expect(a.kind).toBe("card");
    if (a.kind === "card") expect(a.card.summary).toContain("median listed team across the batch is 2");
  });

  it("lists companies outside San Francisco with real locations", () => {
    const a = route(atlas, "Which are outside San Francisco?", inDefense);
    expect(a.kind).toBe("card");
    if (a.kind !== "card") return;
    for (const slug of a.card.highlight) {
      const c = atlas.companies.find((x) => x.slug === slug)!;
      expect(c.city).not.toBe("San Francisco");
      expect(c.group).toBe(defense);
    }
  });

  it("sends money and news questions beyond the snapshot", () => {
    expect(route(atlas, "What has Nori raised?", overview)).toEqual({ kind: "remote", tier: "official" });
    expect(route(atlas, "Search news on Defense", inDefense)).toEqual({ kind: "remote", tier: "web" });
    expect(route(atlas, "Research Edgerun's funding", inDefense)).toEqual({ kind: "remote", tier: "web" });
    expect(route(atlas, "What do analysts think about agents?", overview)).toEqual({ kind: "remote", tier: "official" });
  });

  it("sends open questions to Claude even when they name a company or group", () => {
    expect(route(atlas, "Compare the approaches in Defense", overview)).toEqual({ kind: "remote", tier: "official" });
    expect(route(atlas, "Compare Edgerun with similar companies", overview)).toEqual({ kind: "remote", tier: "official" });
    expect(route(atlas, "Edgerun", overview)).toEqual({ kind: "company", slug: "edgerun" });
  });

  it("changes suggestions with what's on screen", () => {
    expect(suggestions(atlas, overview)[0]).toMatch(/groups/);
    expect(suggestions(atlas, inDefense)[0]).toContain("Defense");
    expect(suggestions(atlas, { group: defense, company: "edgerun" })[0]).toContain("Edgerun");
  });
});
