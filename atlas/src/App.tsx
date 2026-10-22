import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import atlasJson from "../shared/atlas.generated.json";
import { ycProfileUrl, type Atlas } from "../shared/types";
import { Dock } from "./components/Dock";
import { NotesDrawer } from "./components/NotesDrawer";
import { Rail } from "./components/Rail";
import { AnswerScene, CompanyScene, GroupScene, OverviewScene, type AnswerState } from "./components/Scene";
import { ask, getHealth, handoff } from "./lib/api";
import { ARTIFACT, ARTIFACT_URL, getDb, getDownloads, getSample, getUserId, type Sample } from "./lib/env";
import { artifactStore, browserStore, newNote, notesMarkdown, type Note, type NotesStore } from "./lib/notes";
import { combinedBrief } from "./lib/research";
import { route, suggestions, type Context } from "./lib/router";
import { askClaude } from "./lib/sampleAsk";
import { canListen, listen } from "./lib/voice";

const atlas = atlasJson as Atlas;
const PAGES = ["Overview", ...atlas.groups.map((g) => g.name)];
const LAST = PAGES.length - 1;

type View =
  | { kind: "page" }
  | { kind: "company"; slug: string }
  | ({ kind: "answer"; id: number; ctx: Context } & AnswerState);

const readMode = () => {
  try {
    return localStorage.getItem("bs-mode") === "dark";
  } catch {
    return false;
  }
};

export default function App() {
  const [page, setPage] = useState(0);
  const [seen, setSeen] = useState<Set<number>>(() => new Set([0]));
  const [view, setView] = useState<View>({ kind: "page" });
  const [dark, setDark] = useState(readMode);
  const [notes, setNotes] = useState<Note[]>([]);
  const [store, setStore] = useState<NotesStore | null>(null);
  const [canAnswer, setCanAnswer] = useState(false);
  const [canHandoff, setCanHandoff] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [railOpen, setRailOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [askText, setAskText] = useState("");
  const [listening, setListening] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const sampleRef = useRef<Sample | null>(null);
  const answerSeq = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const doneIds = useRef<Set<string> | null>(null);

  const company = view.kind === "company" ? atlas.companies.find((c) => c.slug === view.slug)! : null;
  const pageGroup = page > 0 ? page - 1 : null;
  const ctx: Context =
    view.kind === "answer" ? view.ctx : company ? { group: company.group >= 0 ? company.group : null, company: company.slug } : { group: pageGroup, company: null };

  // Capabilities: what this view can do beyond reading.
  useEffect(() => {
    let off = () => {};
    (async () => {
      if (!ARTIFACT) {
        const h = await getHealth();
        setCanAnswer(h.answers);
        setCanHandoff(h.handoff);
        const s = browserStore();
        setStore(s);
        off = s.subscribe(setNotes);
        return;
      }
      const [sample, db, uid] = await Promise.all([getSample(), getDb(), getUserId()]);
      sampleRef.current = sample;
      setCanAnswer(!!sample);
      const s = db && uid ? artifactStore(db, uid) : browserStore();
      setStore(s);
      off = s.subscribe(setNotes);
    })();
    return () => off();
  }, []);

  useEffect(() => {
    document.documentElement.dataset.mode = dark ? "dark" : "light";
    try {
      localStorage.setItem("bs-mode", dark ? "dark" : "light");
    } catch {
      /* preference won't persist */
    }
  }, [dark]);

  const flash = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((t) => (t === msg ? null : t)), 4500);
  }, []);

  // Tell the viewer when background research lands.
  useEffect(() => {
    const done = new Set(notes.filter((n) => n.finding).map((n) => n.id));
    if (doneIds.current) {
      const fresh = notes.find((n) => n.finding && !doneIds.current!.has(n.id));
      if (fresh) flash(`Finding ready: ${fresh.text.slice(0, 60)}`);
    }
    doneIds.current = done;
  }, [notes, flash]);

  const stopAnswer = () => abortRef.current?.abort();
  const goPage = useCallback((p: number) => {
    abortRef.current?.abort();
    const n = Math.max(0, Math.min(LAST, p));
    setPage(n);
    setSeen((s) => new Set(s).add(n));
    setView({ kind: "page" });
    setRailOpen(false);
  }, []);
  const openCompany = useCallback((slug: string) => {
    abortRef.current?.abort();
    setView({ kind: "company", slug });
    setRailOpen(false);
  }, []);
  const prev = () => (view.kind === "page" ? goPage(page - 1) : goPage(page));
  const next = () => goPage(view.kind === "page" ? page + 1 : page + 1);

  const saveNote = (note: Note) => {
    store?.put(note);
    if (!store) setNotes((ns) => [...ns, note]);
  };

  const noteFromView = (): Note => {
    if (company) return newNote(`${company.name}: ${company.oneLiner}`, "Company", [ycProfileUrl(company.slug), ...(company.website ? [company.website] : [])], company.slug);
    if (view.kind === "answer") {
      return newNote(view.card ? `${view.question} — ${view.card.summary}` : view.question, "Question", view.card?.sources.map((s) => s.url) ?? [], view.ctx.company);
    }
    if (pageGroup !== null) {
      const g = atlas.groups[pageGroup];
      return newNote(`${g.name}: ${g.count} companies, median team ${g.medianTeam}`, "Group");
    }
    return newNote(`YC ${atlas.batch}: ${atlas.companies.length} companies in ${atlas.groups.length} groups`, "Overview");
  };

  const pin = () => {
    saveNote(noteFromView());
    flash("Saved to notes");
  };

  const copyBrief = async (list: Note[]) => {
    try {
      await navigator.clipboard.writeText(combinedBrief(list, atlas.batch, ARTIFACT_URL));
      list.forEach((n) => saveNote({ ...n, status: "copied", error: undefined }));
      flash("Brief copied. Paste it into any Claude chat.");
    } catch {
      flash("Couldn't copy in this view. Use Export instead.");
    }
  };

  /** Send every reviewed note at once: to the atlas queue Claude collects, else a webhook, else a copied brief. */
  const sendNotes = async () => {
    const drafts = notes.filter((n) => n.status === "open" || n.status === "failed");
    if (!drafts.length) return;
    if (store?.kind === "artifact") {
      drafts.forEach((n) => saveNote({ ...n, status: "queued", error: undefined }));
      return flash(`${drafts.length} sent. Claude picks them up when you ask it to research your notes.`);
    }
    if (!ARTIFACT && canHandoff) {
      const sent = await handoff(combinedBrief(drafts, atlas.batch, ""), ctx, drafts.flatMap((n) => n.sources));
      if (sent === "sent") {
        drafts.forEach((n) => saveNote({ ...n, status: "sent" }));
        return flash("Sent to your agent");
      }
    }
    copyBrief(drafts);
  };

  const researchQuestion = (question: string, context: Context) => {
    saveNote(newNote(question, "Needs web research", context.company ? [ycProfileUrl(context.company)] : [], context.company));
    setDrawer(true);
    flash("Added to notes. Add any instructions, then send.");
  };

  const runAnswer = async (question: string, context: Context) => {
    stopAnswer();
    const id = ++answerSeq.current;
    const controller = new AbortController();
    abortRef.current = controller;
    setView({ kind: "answer", id, ctx: context, question, status: "running", steps: [] });
    const update = (fn: (v: Extract<View, { kind: "answer" }>) => Partial<AnswerState>) =>
      setView((v) => (v.kind === "answer" && v.id === id ? { ...v, ...fn(v) } : v));
    const events =
      ARTIFACT && sampleRef.current
        ? askClaude(sampleRef.current, atlas, question, context, controller.signal)
        : ask(question, "official", context, controller.signal);
    for await (const e of events) {
      if (e.type === "step") update((v) => ({ steps: [...v.steps, e.label] }));
      else if (e.type === "card") update(() => ({ status: "done", card: e.card, canResearch: !!e.card.needsWeb || e.card.notStated.length > 0 }));
      else update(() => ({ status: "error", error: e.message, canResearch: true }));
    }
  };

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
      case "company":
        return openCompany(action.slug);
      case "pin":
        return pin();
      case "handoff":
        saveNote(noteFromView());
        return setDrawer(true);
      case "theme":
        return setDark(action.dark ?? !dark);
      case "card":
        stopAnswer();
        return setView({ kind: "answer", id: ++answerSeq.current, ctx, question, status: "done", steps: [], card: action.card });
      case "remote":
        if (action.tier === "web") return researchQuestion(question, ctx);
        if (!canAnswer) {
          return setView({
            kind: "answer",
            id: ++answerSeq.current,
            ctx,
            question,
            status: "error",
            steps: [],
            canResearch: true,
            error: ARTIFACT
              ? "Open this atlas in Claude to ask open questions. Instant questions about groups, teams and locations work here."
              : "Live answers aren't switched on for this server. Instant questions about groups, teams and locations still work.",
          });
        }
        return runAnswer(question, ctx);
    }
  };

  const onMic = () => {
    if (listening) return;
    const { result } = listen();
    setListening(true);
    result.then((heard) => {
      setListening(false);
      if (heard) handleInput(heard);
    });
  };

  // ← → page, / ask, N note, Esc back.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
      if (typing) return;
      if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "/") {
        e.preventDefault();
        inputRef.current?.focus();
      } else if (e.key.toLowerCase() === "n" && !e.metaKey && !e.ctrlKey) pin();
      else if (e.key === "Escape") {
        if (drawer) setDrawer(false);
        else if (view.kind !== "page") goPage(page);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const highlight = useMemo(() => (view.kind === "answer" && view.card?.highlight.length ? new Set(view.card.highlight) : null), [view]);
  const placeholder = company
    ? `Ask about ${company.name}…`
    : ctx.group !== null
      ? `Ask about ${atlas.groups[ctx.group].name.toLowerCase()}…`
      : "Ask anything about the batch…";
  const nextLabel = view.kind === "page" ? (page < LAST ? PAGES[page + 1] : null) : page < LAST ? PAGES[page + 1] : null;

  return (
    <div className="app">
      <header className="top">
        <span className="brand">Batch Signal</span>
        <nav className="crumbs" aria-label="Breadcrumb">
          <button className={view.kind === "page" && page === 0 ? "cur" : ""} onClick={() => goPage(0)}>YC {atlas.batch}</button>
          {(view.kind !== "page" || page > 0) && ctx.group !== null && (
            <>
              <i>/</i>
              <button className={view.kind === "page" ? "cur" : ""} onClick={() => goPage(ctx.group! + 1)}>{atlas.groups[ctx.group].short}</button>
            </>
          )}
          {company && (
            <>
              <i>/</i>
              <span className="cur">{company.name}</span>
            </>
          )}
        </nav>
        <div className="top-actions">
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
          <button className="btn" onClick={() => setDrawer(!drawer)} aria-expanded={drawer} title="Notes">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">
              <path d="M6 3h9l4 4v14H6z" />
              <path d="M14 3v5h5M9 13h7M9 17h5" />
            </svg>
            Notes {notes.length > 0 && <span className="badge num">{notes.length}</span>}
          </button>
        </div>
      </header>

      <main className="stage">
        <section className="scene" aria-live="polite">
          <div className="scene-scroll">
          <div className="fit">
          {view.kind === "page" && page === 0 && <OverviewScene atlas={atlas} onGroup={(g) => goPage(g + 1)} onCompany={openCompany} onNote={pin} />}
          {view.kind === "page" && page > 0 && <GroupScene atlas={atlas} group={page - 1} onCompany={openCompany} onNote={pin} />}
          {view.kind === "company" && <CompanyScene atlas={atlas} slug={view.slug} onCompany={openCompany} onNote={pin} />}
          {view.kind === "answer" && (
            <AnswerScene atlas={atlas} answer={view} onCompany={openCompany} onNote={pin} onResearch={() => researchQuestion(view.question, view.ctx)} />
          )}
          </div>
          </div>
        </section>
        <Rail
          atlas={atlas}
          open={railOpen}
          page={view.kind === "page" ? page : null}
          seen={seen}
          focus={view.kind === "page" ? pageGroup : ctx.group}
          selected={company?.slug ?? null}
          highlight={highlight}
          onPage={goPage}
          onCompany={openCompany}
          onGroup={(g) => goPage(g + 1)}
        />
      </main>

      <Dock
        ref={inputRef}
        canPrev={view.kind !== "page" || page > 0}
        nextLabel={nextLabel}
        value={askText}
        placeholder={placeholder}
        chips={suggestions(atlas, ctx)}
        listening={listening}
        showMic={!ARTIFACT && canListen()}
        onPrev={prev}
        onNext={next}
        onChange={setAskText}
        onSubmit={() => handleInput(askText)}
        onChip={handleInput}
        onMic={onMic}
      />

      {drawer && (
        <NotesDrawer
          atlas={atlas}
          notes={notes}
          queue={store?.kind === "artifact"}
          onClose={() => setDrawer(false)}
          onComment={(n, comment) => saveNote({ ...n, comment })}
          onSend={sendNotes}
          onCopy={copyBrief}
          onRemove={(id) => store?.remove(id)}
          onCompany={(slug) => {
            setDrawer(false);
            openCompany(slug);
          }}
          onExport={async () => {
            const md = notesMarkdown(notes, atlas.batch);
            if (ARTIFACT) {
              const downloads = await getDownloads();
              await downloads?.save({ filename: "batch-signal-notes.md", data: md }).catch(() => {});
              return;
            }
            const a = document.createElement("a");
            a.href = URL.createObjectURL(new Blob([md], { type: "text/markdown" }));
            a.download = "batch-signal-notes.md";
            a.click();
            URL.revokeObjectURL(a.href);
          }}
        />
      )}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
