import { describe, expect, it } from "vitest";
import { route, suggestions, type Context } from "../src/lib/router";
import { yc } from "./fixture";

const atlas = yc();
const overview: Context = { group: null, item: null };
const defense = atlas.groups.findIndex((g) => g.id === "defense");
const inDefense: Context = { group: defense, item: null };

describe("router", () => {
  it("handles controls", () => {
    expect(route(atlas, "next", overview)).toEqual({ kind: "next" });
    expect(route(atlas, "zoom out", inDefense)).toEqual({ kind: "home" });
    expect(route(atlas, "add this to my notes", inDefense)).toEqual({ kind: "note" });
    expect(route(atlas, "switch to dark mode", overview)).toEqual({ kind: "theme", dark: true });
  });

  it("navigates to named groups and items", () => {
    expect(route(atlas, "take me to defense", overview)).toEqual({ kind: "group", group: defense });
    expect(route(atlas, "Robotics", overview)).toMatchObject({ kind: "group" });
    expect(route(atlas, "open Isengard Industries Inc", overview)).toEqual({ kind: "item", id: "isengard-industries-inc" });
  });

  it("ranks by the number fact for the group on screen", () => {
    const a = route(atlas, "Largest team size in Defense", overview);
    expect(a.kind).toBe("card");
    if (a.kind !== "card") return;
    const bars = a.card.blocks[0];
    expect(bars.type).toBe("bars");
    if (bars.type === "bars") expect(bars.items[0].label).toBe("Isengard Industries Inc");
  });

  it("answers collection-wide rankings with group medians", () => {
    const a = route(atlas, "Which groups have the largest team size?", inDefense);
    expect(a.kind).toBe("card");
    if (a.kind === "card") expect(a.card.summary).toContain("median team size across all 230 companies is 2");
  });

  it("lists items outside a place with real values", () => {
    const a = route(atlas, "Which are outside San Francisco?", inDefense);
    expect(a.kind).toBe("card");
    if (a.kind !== "card") return;
    expect(a.card.summary).toContain("outside San Francisco");
    for (const id of a.card.highlight) {
      const it = atlas.items.find((x) => x.id === id)!;
      expect(String(it.facts.location)).not.toContain("San Francisco");
      expect(it.group).toBe(defense);
    }
  });

  it("turns outside-world questions into research notes", () => {
    expect(route(atlas, "What has Nori raised?", overview)).toEqual({ kind: "research" });
    expect(route(atlas, "Latest news on Defense", inDefense)).toEqual({ kind: "research" });
  });

  it("sends open questions to Claude even when they name an item or group", () => {
    expect(route(atlas, "Compare the approaches in Defense", overview)).toEqual({ kind: "ask" });
    expect(route(atlas, "Compare Edgerun with similar companies", overview)).toEqual({ kind: "ask" });
    expect(route(atlas, "Edgerun", overview)).toEqual({ kind: "item", id: "edgerun" });
  });

  it("changes suggestions with what's on screen", () => {
    expect(suggestions(atlas, overview)[0]).toMatch(/groups/);
    expect(suggestions(atlas, inDefense)[0]).toContain("Defense");
    expect(suggestions(atlas, { group: defense, item: "edgerun" })[0]).toContain("Edgerun");
  });
});
