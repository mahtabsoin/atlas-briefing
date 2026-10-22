// Turns typed or spoken input into an action. Everything the snapshot can
// answer is answered here, instantly; only the rest goes to the server.
import type { Card } from "../../shared/card";
import { cityCounts, findCompanyInText, findGroupInText, inGroup, largestTeams, median } from "../../shared/dataset";
import type { Atlas } from "../../shared/types";

export type Context = { group: number | null; company: string | null };

export type Action =
  | { kind: "play" }
  | { kind: "pause" }
  | { kind: "next" }
  | { kind: "prev" }
  | { kind: "home" }
  | { kind: "group"; group: number }
  | { kind: "company"; slug: string }
  | { kind: "pin" }
  | { kind: "handoff" }
  | { kind: "theme"; dark: boolean | null }
  | { kind: "card"; card: Card }
  | { kind: "remote"; tier: "official" | "web" };

export function route(atlas: Atlas, input: string, ctx: Context): Action {
  const s = input.trim().toLowerCase().replace(/[?.!]+$/, "");
  const subject = subjectGroup(atlas, s, ctx);

  // Navigation and controls
  if (/^(play|resume|continue|start)( the tour)?$/.test(s)) return { kind: "play" };
  if (/^(pause|stop|wait|hold on)$/.test(s)) return { kind: "pause" };
  if (/^(next|skip)( group| chapter)?$/.test(s)) return { kind: "next" };
  if (/^(back|previous|go back)$/.test(s)) return { kind: "prev" };
  if (/^(zoom out|overview|show (me )?everything|home|all companies)$/.test(s)) return { kind: "home" };
  if (/(dark|night) mode/.test(s)) return { kind: "theme", dark: true };
  if (/light mode/.test(s)) return { kind: "theme", dark: false };
  if (/^(pin|save|note|add)\b|to (my )?notes/.test(s)) return { kind: "pin" };
  if (/hand ?off|send (this |it )?to (an |my )?agent/.test(s)) return { kind: "handoff" };

  // Anything about money, news or the outside world needs sources beyond the snapshot
  if (/\b(news|press|coverage|search the web|web search)\b/.test(s)) return { kind: "remote", tier: "web" };
  if (/\b(funding|raised|investors?|valuation|revenue|customers|traction|official|website|filing|launch)\b/.test(s)) {
    return { kind: "remote", tier: "official" };
  }

  if (/\b(team|teams|size|biggest|largest|people|headcount)\b/.test(s)) return { kind: "card", card: teamsCard(atlas, subject) };
  if (/outside (of )?(san francisco|sf)/.test(s)) return { kind: "card", card: outsideSfCard(atlas, subject) };
  if (/\b(where|based|located|locations?|cities|city)\b/.test(s)) return { kind: "card", card: locationsCard(atlas, subject) };
  if (/\b(ungrouped|grey|gray|outside the (eight |8 )?groups|other companies)\b/.test(s)) return { kind: "card", card: ungroupedCard(atlas) };
  if (/how (were|are) (the )?groups|method|classif/.test(s)) return { kind: "card", card: methodCard(atlas) };

  // A group or company named outright means "take me there"
  const company = findCompanyInText(atlas, s);
  const group = findGroupInText(atlas, s);
  if (company && (group === null || company.name.length >= atlas.groups[group].short.length)) {
    return { kind: "company", slug: company.slug };
  }
  if (group !== null) return { kind: "group", group };
  if (/defen[cs]e|military|drones?/.test(s)) return { kind: "group", group: atlas.groups.findIndex((g) => g.id === "defense") };

  return { kind: "remote", tier: "official" };
}

/** Suggestions follow what's on screen. */
export function suggestions(atlas: Atlas, ctx: Context): string[] {
  if (ctx.company) {
    const name = atlas.companies.find((c) => c.slug === ctx.company)!.name;
    return [`What has ${name} raised?`, `Add ${name} to notes`, `Hand off: research ${name}`];
  }
  if (ctx.group !== null) {
    const g = atlas.groups[ctx.group];
    return [`Largest teams in ${g.short}`, "Which are outside San Francisco?", `Search news on ${g.short}`];
  }
  return ["Which groups have the biggest teams?", "Where are these companies based?", "Show the ungrouped companies"];
}

function subjectGroup(atlas: Atlas, s: string, ctx: Context): number | null {
  if (/\b(batch|all|overall|every|groups)\b/.test(s)) return null;
  return findGroupInText(atlas, s) ?? ctx.group;
}

const dataset = (card: Partial<Card> & Pick<Card, "summary">): Card => ({
  tier: "dataset",
  blocks: [],
  sources: [],
  notStated: [],
  highlight: [],
  ...card,
});

function teamsCard(atlas: Atlas, group: number | null): Card {
  if (group !== null) {
    const g = atlas.groups[group];
    const top = largestTeams(atlas, group);
    return dataset({
      summary: `Largest listed teams in ${g.name}. The group median is ${g.medianTeam}.`,
      blocks: [{ type: "bars", title: "Listed team size", items: top.map((c) => ({ label: c.name, value: c.teamSize!, slug: c.slug })) }],
      highlight: top.map((c) => c.slug),
    });
  }
  const largest = largestTeams(atlas, null, 1)[0];
  const top = [...atlas.groups].sort((a, b) => b.medianTeam - a.medianTeam)[0];
  return dataset({
    summary: `The median listed team across the batch is ${median(atlas.companies.map((c) => c.teamSize ?? 0))}. ${top.name} has the highest group median, ${top.medianTeam}. ${largest.name} lists ${largest.teamSize}, the most of any company.`,
    blocks: [
      {
        type: "bars",
        title: "Median listed team size by group",
        items: [...atlas.groups].sort((a, b) => b.medianTeam - a.medianTeam).map((g) => ({ label: g.short, value: g.medianTeam })),
      },
      { type: "text", text: "Team size as listed on each YC profile, counting the whole team. Companies without a listed size are left out." },
    ],
  });
}

function locationsCard(atlas: Atlas, group: number | null): Card {
  const counts = cityCounts(atlas, group).slice(0, 6);
  const total = inGroup(atlas, group).length;
  const scope = group === null ? "the batch" : atlas.groups[group].name;
  return dataset({
    summary: `${counts[0][1]} of ${total} companies in ${scope} list ${counts[0][0]} as their primary location.`,
    blocks: [{ type: "bars", title: "Primary location, top 6", items: counts.map(([label, value]) => ({ label, value })) }],
  });
}

function outsideSfCard(atlas: Atlas, group: number | null): Card {
  const all = inGroup(atlas, group);
  const xs = all.filter((c) => c.city !== "San Francisco");
  const scope = group === null ? "the batch" : atlas.groups[group].name;
  return dataset({
    summary: `${xs.length} of ${all.length} companies in ${scope} list a primary location outside San Francisco.`,
    blocks: [{ type: "companies", items: xs.slice(0, 24).map((c) => ({ slug: c.slug, note: c.location })) }],
    highlight: xs.map((c) => c.slug),
  });
}

function ungroupedCard(atlas: Atlas): Card {
  const xs = atlas.companies.filter((c) => c.group < 0);
  return dataset({
    summary: `${xs.length} companies don't share a clear group with others. They're highlighted on the map.`,
    blocks: [{ type: "companies", title: "A few of them", items: xs.slice(0, 8).map((c) => ({ slug: c.slug })) }],
    highlight: xs.map((c) => c.slug),
  });
}

function methodCard(atlas: Atlas): Card {
  const grouped = atlas.companies.filter((c) => c.group >= 0);
  const calls = grouped.filter((c) => !c.evidence).length;
  return dataset({
    summary: `A company joins a group only if its own YC one-liner contains a phrase that supports it. ${grouped.length - calls} of ${grouped.length} placements have one; ${calls} are marked as judgment calls.`,
    blocks: [{ type: "facts", items: atlas.groups.map((g) => ({ label: g.short, value: g.rubric })) }],
  });
}
