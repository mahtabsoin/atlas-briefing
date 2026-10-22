// Notes are questions and leads the viewer wants followed up. They're saved in
// the artifact when it has a store (so background research can write findings
// next to them), otherwise in this browser.
import type { Card } from "../../shared/card";
import { CardSchema } from "../../shared/card";
import type { Db } from "./env";

export type NoteStatus = "open" | "researching" | "done" | "failed" | "copied" | "sent";

export type Note = {
  id: string;
  text: string;
  meta: string;
  sources: string[];
  /** Company or group the note was taken on, for research context. */
  subject: string | null;
  status: NoteStatus;
  sessionUrl?: string;
  error?: string;
  finding?: Card;
  createdAt: string;
};

export const newNote = (text: string, meta: string, sources: string[] = [], subject: string | null = null): Note => ({
  id: `n${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
  text,
  meta,
  sources,
  subject,
  status: "open",
  createdAt: new Date().toISOString(),
});

export type NotesStore = {
  kind: "artifact" | "browser";
  subscribe(cb: (notes: Note[]) => void): () => void;
  put(note: Note): void;
  remove(id: string): void;
};

const KEY = "bs-notes";

export function browserStore(): NotesStore {
  let notes: Note[] = [];
  try {
    notes = JSON.parse(localStorage.getItem(KEY) ?? "[]") as Note[];
  } catch {
    notes = [];
  }
  const listeners = new Set<(n: Note[]) => void>();
  const emit = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(notes));
    } catch {
      // Private mode: notes last for this visit only.
    }
    listeners.forEach((l) => l(notes));
  };
  return {
    kind: "browser",
    subscribe(cb) {
      listeners.add(cb);
      cb(notes);
      return () => listeners.delete(cb);
    },
    put(note) {
      notes = notes.some((n) => n.id === note.id) ? notes.map((n) => (n.id === note.id ? note : n)) : [...notes, note];
      emit();
    },
    remove(id) {
      notes = notes.filter((n) => n.id !== id);
      emit();
    },
  };
}

/** Notes in `notes/<id>`, findings written by background research in `findings/<noteId>`. */
export function artifactStore(db: Db, owner: string): NotesStore {
  return {
    kind: "artifact",
    subscribe(cb) {
      let notes: Note[] = [];
      let findings = new Map<string, Card>();
      const emit = () =>
        cb(
          notes
            .map((n) => (findings.has(n.id) ? { ...n, finding: findings.get(n.id), status: "done" as const } : n))
            .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
        );
      const offNotes = db
        .collection("notes")
        .where("owner", "==", owner)
        .onSnapshot((s) => {
          notes = s.docs.filter((d) => d.exists).map((d) => d.data() as unknown as Note);
          emit();
        });
      const offFindings = db
        .collection("findings")
        .where("owner", "==", owner)
        .onSnapshot((s) => {
          findings = new Map();
          for (const d of s.docs) {
            const parsed = CardSchema.safeParse(d.data()?.card);
            if (parsed.success) findings.set(d.id, parsed.data);
          }
          emit();
        });
      return () => {
        offNotes();
        offFindings();
      };
    },
    put(note) {
      const { finding: _ignored, ...rest } = note;
      db.collection("notes").doc(note.id).set({ ...rest, owner }).catch(() => {});
    },
    remove(id) {
      db.collection("notes").doc(id).delete().catch(() => {});
      db.collection("findings").doc(id).delete().catch(() => {});
    },
  };
}

/** A self-contained brief an agent can act on without seeing this app. */
export function agentBrief(note: Note, batch: string): string {
  return [
    `Research task from Batch Signal (YC ${batch}).`,
    "",
    note.text,
    "",
    "Rules: use official sources first (YC profile, company website and press releases, SEC filings), then reputable press with a named author and date. Cite every claim with a link. Say \"not stated\" where no source answers. No opinions. Under 150 words.",
    note.sources.length ? `\nStarting points:\n${note.sources.map((s) => `- ${s}`).join("\n")}` : "",
  ].join("\n");
}

export function notesMarkdown(notes: Note[], batch: string): string {
  const lines = [`# Batch Signal notes · YC ${batch}`, ""];
  for (const n of notes) {
    lines.push(`- ${n.text}`, `  - ${n.meta} · ${n.createdAt.slice(0, 10)}`);
    if (n.finding) {
      lines.push(`  - Finding: ${n.finding.summary}`);
      for (const s of n.finding.sources) lines.push(`    - ${s.title}: ${s.url}`);
    }
    for (const s of n.sources) lines.push(`  - ${s}`);
  }
  return lines.join("\n") + "\n";
}
