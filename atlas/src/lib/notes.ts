// Notes live in this browser only. Export them, or hand one off to an agent.

export type Note = {
  id: string;
  text: string;
  meta: string;
  sources: string[];
  status: "open" | "sent" | "copied";
  createdAt: string;
};

const KEY = "bs-notes";

export function loadNotes(): Note[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Note[]) : [];
  } catch {
    return [];
  }
}

export function saveNotes(notes: Note[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(notes));
  } catch {
    // Storage can be unavailable (private mode); notes then last for the session.
  }
}

export const newNote = (text: string, meta: string, sources: string[] = []): Note => ({
  id: Math.random().toString(36).slice(2, 10),
  text,
  meta,
  sources,
  status: "open",
  createdAt: new Date().toISOString(),
});

/** A self-contained brief an agent can act on without seeing this app. */
export function agentBrief(note: Note, batch: string): string {
  return [
    `Research task from Batch Signal (YC ${batch}).`,
    "",
    note.text,
    "",
    "Rules: use official sources first (YC profile, company website and press releases, SEC filings), then reputable press with a named author and date. Cite every claim with a link. Say \"not stated\" where no source answers. No opinions.",
    note.sources.length ? `\nStarting points:\n${note.sources.map((s) => `- ${s}`).join("\n")}` : "",
  ].join("\n");
}

export function notesMarkdown(notes: Note[], batch: string): string {
  const lines = [`# Batch Signal notes · YC ${batch}`, ""];
  for (const n of notes) {
    lines.push(`- ${n.text}`, `  - ${n.meta} · ${n.createdAt.slice(0, 10)}`);
    for (const s of n.sources) lines.push(`  - ${s}`);
  }
  return lines.join("\n") + "\n";
}
