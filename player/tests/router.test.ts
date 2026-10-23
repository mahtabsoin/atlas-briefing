import { describe, expect, it } from "vitest";
import { largest } from "../shared/dataset";
import { questions, quickFacts, route, type Context } from "../src/lib/router";
import { payload, pickGroup, pickItem } from "../src/lib/tray";
import { yc } from "./fixture";

const atlas = yc();
const overview: Context = { group: null, item: null };
const defense = atlas.groups.findIndex((g) => g.id === "defense");
const inDefense: Context = { group: defense, item: null };

describe("router", () => {
  it("handles controls", () => {
    expect(route(atlas, "next", overview)).toEqual({ kind: "next" });
    expect(route(atlas, "zoom out", inDefense)).toEqual({ kind: "home" });
    expect(route(atlas, "switch to dark mode", overview)).toEqual({ kind: "theme", dark: true });
  });

  it("navigates to groups by name or the first word of their label", () => {
    expect(route(atlas, "take me to defense", overview)).toEqual({ kind: "group", group: defense });
    expect(route(atlas, "Robotics", overview)).toMatchObject({ kind: "group" });
    expect(route(atlas, "open Isengard Industries Inc", overview)).toEqual({ kind: "item", id: "isengard-industries-inc" });
  });

  it("ranks by the number fact for the group on screen", () => {
    const a = route(atlas, "Largest team size in Defense", overview);
    expect(a.kind).toBe("card");
    if (a.kind !== "card" || a.card.blocks[0].type !== "bars") return;
    expect(a.card.blocks[0].items[0].label).toBe(largest(atlas, defense, "team", 1)[0].name);
  });

  it("lists items outside a place with real values", () => {
    const a = route(atlas, "Which are outside San Francisco?", inDefense);
    expect(a.kind).toBe("card");
    if (a.kind !== "card") return;
    for (const id of a.card.highlight) {
      const it = atlas.items.find((x) => x.id === id)!;
      expect(String(it.facts.location)).not.toContain("San Francisco");
      expect(it.group).toBe(defense);
    }
  });

  it("turns outside-world questions into research", () => {
    expect(route(atlas, "What has Nori raised?", overview)).toEqual({ kind: "research" });
  });
});

describe("what the left column offers", () => {
  it("offers quick facts that all resolve to cards", () => {
    expect(quickFacts(atlas, overview).length).toBe(4);
    expect(quickFacts(atlas, inDefense)[0].card.summary).toContain("Defense and security");
    expect(quickFacts(atlas, overview).map((f) => f.card.summary)[3]).toContain("placements quote a supporting phrase");
    expect(quickFacts(atlas, { group: defense, item: "edgerun" })).toEqual([]);
  });

  it("offers Claude questions that follow the screen and the batch filter", () => {
    expect(questions(atlas, overview, null).some((q) => q.includes("batches"))).toBe(true);
    expect(questions(atlas, overview, "Fall 2026").some((q) => q.includes("batches"))).toBe(false);
    expect(questions(atlas, inDefense, "Fall 2026")[0]).toContain("(Fall 2026)");
    expect(questions(atlas, inDefense, null)[0]).toContain("across the batches");
    expect(questions(atlas, { group: defense, item: "edgerun" }, null)[0]).toContain("Edgerun");
  });
});

describe("hand-off payload", () => {
  it("stays under the platform's 4 KiB cap however much is picked", () => {
    const picks = atlas.groups.map((_, g) => pickGroup(atlas, g, null)).concat(atlas.items.slice(0, 20).map((it) => pickItem(atlas, it.id)));
    const data = payload(atlas, picks, { page: "Overview", scope: null }, "Compare these.");
    expect(JSON.stringify(data).length).toBeLessThanOrEqual(3900);
    expect(data.question).toBe("Compare these.");
    expect((data.picks as unknown[]).length).toBeGreaterThan(0);
  });

  it("keeps keys plain identifiers and arrays within 64 entries", () => {
    const data = payload(atlas, [pickItem(atlas, "edgerun")], { page: "Edgerun", scope: "Summer 2026" });
    const walk = (v: unknown): void => {
      if (Array.isArray(v)) {
        expect(v.length).toBeLessThanOrEqual(64);
        v.forEach(walk);
      } else if (v && typeof v === "object") {
        for (const [k, x] of Object.entries(v)) {
          expect(k).toMatch(/^[A-Za-z_][A-Za-z0-9_-]*$/);
          walk(x);
        }
      }
    };
    walk(data);
    expect(data.viewing).toBe("Edgerun, filtered to Summer 2026");
  });
});
