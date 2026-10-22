// Notes go to Claude through a queue kept in this atlas's store: the viewer
// reviews notes, adds comments, then sends them. Any Claude Code session asked
// to "research my Batch Signal notes" (see .claude/skills/batch-signal-research)
// reads the queue, researches on the web, and writes findings back here.
// Pages can't start Claude sessions themselves, so nothing is pasted by hand
// except where the atlas has no store (then the brief is copied).
import type { Note } from "./notes";

export const PICKUP_PHRASE = "Research my Batch Signal notes";

/** One brief covering several notes, for when there's no queue to send to. */
export function combinedBrief(notes: Note[], batch: string, atlasUrl: string): string {
  const items = notes.map((n, i) => {
    const lines = [`${i + 1}. ${n.text}`];
    if (n.comment) lines.push(`   My notes: ${n.comment}`);
    if (n.sources.length) lines.push(`   Start from: ${n.sources.join(", ")}`);
    return lines.join("\n");
  });
  return [
    `Research these items from my Batch Signal atlas (YC ${batch})${atlasUrl ? `, ${atlasUrl}` : ""}:`,
    "",
    ...items,
    "",
    "Search the web. Official sources first (YC profile, company site and press releases, SEC filings), then reputable press with a named author and date. Cite every claim with a link. Say \"not stated\" where nothing answers. No opinions. Keep each answer under 150 words.",
  ].join("\n");
}
