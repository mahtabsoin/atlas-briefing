import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { findGroupInText, findItemInText, itemUrls } from "../shared/dataset";
import { Dock } from "./components/Dock";
import { NoteSheet } from "./components/NoteSheet";
import { Rail } from "./components/Rail";
import { AnswerScene, GroupScene, ItemScene, OverviewScene, type AnswerState } from "./components/Scene";
import { getComments, getSample, IN_CLAUDE, loadAtlas, type Comments, type Sample } from "./lib/env";
import { brief, noteText, PICKUP, sendText, type Note } from "./lib/notes";
import { route, suggestions, type Context } from "./lib/router";
import { askClaude } from "./lib/sampleAsk";

const atlas = loadAtlas();
const PAGES = ["Overview", ...atlas.groups.map((g) => g.name)];
const LAST = PAGES.length - 1;
const MANY = atlas.noun[1];

type View =
  | { kind: "page" }
  | { kind: "item"; id: string }
  | ({ kind: "answer"; id: number; ctx: Context } & AnswerState);

type Sheet = { subject: string; initial: string; urls: string[] };

const readMode = () => {
  try {
    return localStorage.getItem("atlas-mode") === "dark";
  } catch {
    return false;
  }
};

export default function App() {
  const [page, setPage] = useState(0);
  const [seen, setSeen] = useState<Set<number>>(() => new Set([0]));
  const [view, setView] = useState<View>({ kind: "page" });
  const [dark, setDark] = useState(readMode);
  const [railOpen, setRailOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [askText, setAskText] = useState("");
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [busy, setBusy] = useState(false);
  /** Notes left this visit. They live on as comment threads either way. */
  const [notes, setNotes] = useState<Note[]>([]);
  const [sample, setSample] = useState<Sample | null>(null);
  const [comments, setComments] = useState<Comments | null>(null);
  /** Composer-only atlases (shared publicly) can't post for the viewer; the shell's comment box opens instead. */
  const [composerOnly, setComposerOnly] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const sceneRef = useRef<HTMLElement>(null);
  const topRef = useRef<HTMLElement>(null);
  const answerSeq = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const item = view.kind === "item" ? atlas.items.find((it) => it.id === view.id)! : null;
  const pageGroup = page > 0 ? page - 1 : null;
  const ctx: Context =
    view.kind === "answer" ? view.ctx : item ? { group: item.group >= 0 ? item.group : null, item: item.id } : { group: pageGroup, item: null };

  useEffect(() => {
    if (!IN_CLAUDE) return;
    (async () => {
      const [s, c] = await Promise.all([getSample(), getComments()]);
      setSample(s);
      setComments(c);
      if (c) setComposerOnly((await c.canSendToClaude().catch(() => "off")) === "off");
    })();
  }, []);

  useEffect(() => {
    document.documentElement.dataset.mode = dark ? "dark" : "light";
    try {
      localStorage.setItem("atlas-mode", dark ? "dark" : "light");
    } catch {
      /* preference won't persist */
    }
  }, [dark]);

  const flash = useCallback((msg: string, ms = 5000) => {
    setToast(msg);
    window.setTimeout(() => setToast((t) => (t === msg ? null : t)), ms);
  }, []);

  const goPage = useCallback((p: number) => {
    abortRef.current?.abort();
    const n = Math.max(0, Math.min(LAST, p));
    setPage(n);
    setSeen((s) => new Set(s).add(n));
    setView({ kind: "page" });
    setRailOpen(false);
  }, []);
  const openItem = useCallback((id: string) => {
    abortRef.current?.abort();
    setView({ kind: "item", id });
    setRailOpen(false);
  }, []);
  const prev = () => (view.kind === "page" ? goPage(page - 1) : goPage(page));
  const next = () => goPage(page + 1);

  const aboutItem = (id: string) => {
    const it = atlas.items.find((x) => x.id === id)!;
    return { subject: `${it.name}: ${it.summary}`, urls: itemUrls(it) };
  };
  const aboutGroup = (g: number) => ({ subject: `${atlas.groups[g].name} (${atlas.groups[g].count} ${MANY} in ${atlas.title})`, urls: [] });

  /** What a note is about: whatever the text names, else what's on screen. */
  const subjectHere = (text = ""): Omit<Sheet, "initial"> => {
    const named = text ? findItemInText(atlas, text) : undefined;
    if (named) return aboutItem(named.id);
    const group = text ? findGroupInText(atlas, text) : null;
    if (group !== null) return aboutGroup(group);
    if (ctx.item) return aboutItem(ctx.item);
    if (ctx.group !== null) return aboutGroup(ctx.group);
    return { subject: `${atlas.title} (${atlas.items.length} ${MANY})`, urls: [atlas.source.url] };
  };

  const anchorEl = () => sceneRef.current?.querySelector("h1") ?? sceneRef.current!;

  const openNote = (initial = "") => {
    if (comments && composerOnly) {
      comments
        .openComposer({ element: anchorEl() })
        .then((r) => !r.opened && flash("Finish the comment you have open first."))
        .catch(() => flash("Comments aren't available in this view."));
      return;
    }
    const ask = initial || (view.kind === "answer" ? view.question : "");
    setSheet({ ...subjectHere(ask), initial: ask });
  };

  const addNote = async (ask: string) => {
    if (!sheet) return;
    const note: Note = { subject: sheet.subject, ask, urls: sheet.urls };
    if (!comments) {
      setNotes((ns) => [...ns, note]);
      setSheet(null);
      return flash("Noted. Send them all to Claude when you're done.");
    }
    setBusy(true);
    try {
      const { threadId } = await comments.create({ anchor: await comments.anchorFor(anchorEl()), text: noteText(note) });
      setNotes((ns) => [...ns, { ...note, threadId }]);
      setSheet(null);
      flash("Added as a comment. Keep going, then send them all at once.");
    } catch (e) {
      const code = (e as { code?: string })?.code;
      if (code === "consent_required") flash("Not added: allow this page to comment for you, then try again.");
      else if (code === "forbidden" || code === "not_granted" || code === "capability_disabled" || code === "capability_removed") {
        setComposerOnly(true);
        setSheet(null);
        flash("This atlas can't post for you. Use the comment box instead.");
        comments.openComposer({ element: anchorEl() }).catch(() => {});
      } else flash("Couldn't add the note just now. Try again.");
    } finally {
      setBusy(false);
    }
  };

  /** Hand every note to Claude in one go. */
  const sendNotes = async () => {
    if (!notes.length) return;
    if (!comments) {
      try {
        await navigator.clipboard.writeText(brief(notes, atlas.title));
        flash("Copied. Paste into Claude: outside Claude, copying is the only way to hand notes over.", 7000);
      } catch {
        flash("Couldn't copy here. Open this atlas in Claude to send notes.");
      }
      return;
    }
    const can = await comments.canSendToClaude().catch(() => "off");
    if (can === "available") {
      try {
        await comments.sendToClaude({ anchor: await comments.anchorFor(topRef.current!), text: sendText(notes, atlas.title) });
        setNotes([]);
        return flash("Sent. Claude answers in each comment thread.");
      } catch {
        /* nothing was posted; fall through to the pickup phrase */
      }
    }
    flash(`Your notes are saved as comments. In a Claude chat, say "${PICKUP}".`, 8000);
  };

  const runAnswer = async (question: string, context: Context) => {
    abortRef.current?.abort();
    const id = ++answerSeq.current;
    const controller = new AbortController();
    abortRef.current = controller;
    setView({ kind: "answer", id, ctx: context, question, status: "running", steps: [] });
    const update = (fn: (v: Extract<View, { kind: "answer" }>) => Partial<AnswerState>) =>
      setView((v) => (v.kind === "answer" && v.id === id ? { ...v, ...fn(v) } : v));
    for await (const e of askClaude(sample!, atlas, question, context, controller.signal)) {
      if (e.type === "step") update((v) => ({ steps: [...v.steps, e.label] }));
      else if (e.type === "card") update(() => ({ status: "done", card: e.card, canResearch: !!e.card.needsWeb || e.card.notStated.length > 0 }));
      else update(() => ({ status: "error", error: e.message }));
    }
  };

  // Instant answers are never about one item, so the item on screen stops being the context.
  const showAnswer = (question: string, state: Partial<AnswerState>) =>
    setView({ kind: "answer", id: ++answerSeq.current, ctx: { group: ctx.group, item: null }, question, status: "done", steps: [], ...state });

  const handleInput = (text: string) => {
    const question = text.trim();
    if (!question) return;
    setAskText("");
    const action = route(atlas, question, ctx);
    switch (action.kind) {
      case "next":
        return next();
      case "prev":
        return prev();
      case "home":
        return goPage(0);
      case "group":
        return goPage(action.group + 1);
      case "item":
        return openItem(action.id);
      case "note":
        return openNote();
      case "theme":
        return setDark(action.dark ?? !dark);
      case "card":
        abortRef.current?.abort();
        return showAnswer(question, { card: action.card });
      case "research":
        return setSheet({ ...subjectHere(question), initial: question });
      case "ask":
        if (!sample) {
          return showAnswer(question, {
            status: "error",
            error: IN_CLAUDE
              ? "Open questions need permission to use your Claude. Instant questions and notes still work."
              : `Open questions work when this atlas is open in Claude. Instant questions about groups, ${atlas.facts.map((f) => f.label.toLowerCase()).slice(0, 2).join(" and ")} work here.`,
          });
        }
        return runAnswer(question, ctx);
    }
  };

  // ← → page, / ask, N note, Esc back.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
      if (typing || sheet) return;
      if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "/") {
        e.preventDefault();
        inputRef.current?.focus();
      } else if (e.key.toLowerCase() === "n" && !e.metaKey && !e.ctrlKey) openNote();
      else if (e.key === "Escape" && view.kind !== "page") goPage(page);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const highlight = useMemo(() => (view.kind === "answer" && view.card?.highlight.length ? new Set(view.card.highlight) : null), [view]);
  const placeholder = item ? `Ask about ${item.name}…` : ctx.group !== null ? `Ask about ${atlas.groups[ctx.group].short}…` : `Ask about these ${MANY}…`;

  return (
    <div className="app">
      <header className="top" ref={topRef}>
        <nav className="crumbs" aria-label="Breadcrumb">
          <button className={view.kind === "page" && page === 0 ? "cur" : ""} onClick={() => goPage(0)}>{atlas.title}</button>
          {(view.kind !== "page" || page > 0) && ctx.group !== null && (
            <>
              <i>/</i>
              <button className={view.kind === "page" ? "cur" : ""} onClick={() => goPage(ctx.group! + 1)}>{atlas.groups[ctx.group].short}</button>
            </>
          )}
          {item && (
            <>
              <i>/</i>
              <span className="cur">{item.name}</span>
            </>
          )}
        </nav>
        <div className="top-actions">
          {notes.length > 0 && (
            <button className="btn primary" onClick={sendNotes} title="Send every note to Claude at once">
              Send {notes.length} {notes.length === 1 ? "note" : "notes"} to Claude
            </button>
          )}
          <button className="btn ghost map-toggle" onClick={() => setRailOpen(!railOpen)} aria-pressed={railOpen}>Map</button>
          <button className="btn icon" onClick={() => setDark(!dark)} aria-label={`Switch to ${dark ? "light" : "dark"} mode`} title={dark ? "Light mode" : "Dark mode"}>
            {dark ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">
                <path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11Z" />
              </svg>
            )}
          </button>
        </div>
      </header>

      <main className="stage">
        <section className="scene" aria-live="polite" ref={sceneRef}>
          <div className="scene-scroll">
            <div className="fit">
              {view.kind === "page" && page === 0 && <OverviewScene atlas={atlas} onGroup={(g) => goPage(g + 1)} onItem={openItem} onNote={() => openNote()} />}
              {view.kind === "page" && page > 0 && <GroupScene atlas={atlas} group={page - 1} onItem={openItem} onNote={() => openNote()} />}
              {view.kind === "item" && <ItemScene atlas={atlas} id={view.id} onItem={openItem} onNote={() => openNote()} />}
              {view.kind === "answer" && <AnswerScene atlas={atlas} answer={view} onItem={openItem} onNote={() => openNote()} />}
            </div>
          </div>
        </section>
        <Rail
          atlas={atlas}
          open={railOpen}
          page={view.kind === "page" ? page : null}
          seen={seen}
          focus={view.kind === "page" ? pageGroup : ctx.group}
          selected={item?.id ?? null}
          highlight={highlight}
          onPage={goPage}
          onItem={openItem}
          onGroup={(g) => goPage(g + 1)}
        />
      </main>

      <Dock
        ref={inputRef}
        canPrev={view.kind !== "page" || page > 0}
        nextLabel={page < LAST ? PAGES[page + 1] : null}
        value={askText}
        placeholder={placeholder}
        chips={suggestions(atlas, ctx)}
        onPrev={prev}
        onNext={next}
        onChange={setAskText}
        onSubmit={() => handleInput(askText)}
        onChip={handleInput}
      />

      {sheet && <NoteSheet subject={sheet.subject} initial={sheet.initial} busy={busy} onAdd={addNote} onCancel={() => setSheet(null)} />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
