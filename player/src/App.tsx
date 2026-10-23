import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { scopeTo } from "../shared/dataset";
import { Continue } from "./components/Continue";
import { Rail } from "./components/Rail";
import { AnswerScene, GroupScene, ItemScene, OverviewScene, type AnswerState } from "./components/Scene";
import { getRoom, IN_CLAUDE, loadAtlas, type CanSend, type Json, type Room } from "./lib/env";
import { questions, quickFacts, type Context } from "./lib/router";
import { asText, payload, pickGroup, pickItem, type Pick } from "./lib/tray";

const full = loadAtlas();
const PAGES = ["Overview", ...full.groups.map((g) => g.name)];
const LAST = PAGES.length - 1;
const PICKS_KEY = `atlas-picks:${full.title}`;
const CHAT_READY: CanSend[] = ["available", "available_if_summoned", "available_if_opened"];

type View = { kind: "page" } | { kind: "item"; id: string } | ({ kind: "answer"; ctx: Context } & AnswerState);

const read = <T,>(key: string, fallback: T): T => {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
};
const write = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* per-viewer convenience only */
  }
};

export default function App() {
  const [page, setPage] = useState(0);
  const [seen, setSeen] = useState<Set<number>>(() => new Set([0]));
  const [view, setView] = useState<View>({ kind: "page" });
  const [dark, setDark] = useState(() => {
    try {
      return localStorage.getItem("atlas-mode") === "dark";
    } catch {
      return false;
    }
  });
  const [scope, setScope] = useState<string | null>(null);
  const [railOpen, setRailOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [picks, setPicks] = useState<Pick[]>(() => read(PICKS_KEY, []));
  const [canSend, setCanSend] = useState<CanSend>("off");
  const roomRef = useRef<Room | null>(null);

  const atlas = useMemo(() => scopeTo(full, scope), [scope]);
  const item = view.kind === "item" ? full.items.find((it) => it.id === view.id)! : null;
  const pageGroup = page > 0 ? page - 1 : null;
  const ctx: Context = view.kind === "answer" ? view.ctx : item ? { group: item.group >= 0 ? item.group : null, item: item.id } : { group: pageGroup, item: null };
  const route = CHAT_READY.includes(canSend) ? "chat" : "copy";

  const refreshCan = useCallback(() => {
    roomRef.current
      ?.canSendToClaudeSession()
      .then(setCanSend)
      .catch(() => setCanSend("off"));
  }, []);

  useEffect(() => {
    if (!IN_CLAUDE) return;
    getRoom().then((r) => {
      roomRef.current = r;
      refreshCan();
    });
  }, [refreshCan]);

  const pageLabel = item ? item.name : view.kind === "answer" ? `Quick fact: ${view.question}` : pageGroup !== null ? full.groups[pageGroup].name : "Overview";

  // Tell the chat beside the page what the viewer is looking at, and re-check the hand-off route.
  useEffect(() => {
    roomRef.current?.presence({ atlas: full.title, viewing: pageLabel, filter: scope ?? "all" }).catch(() => {});
    refreshCan();
  }, [pageLabel, scope, refreshCan]);

  useEffect(() => {
    document.documentElement.dataset.mode = dark ? "dark" : "light";
    try {
      localStorage.setItem("atlas-mode", dark ? "dark" : "light"); // read raw by the first-paint script
    } catch {
      /* preference won't persist */
    }
  }, [dark]);
  useEffect(() => write(PICKS_KEY, picks), [picks]);

  const flash = useCallback((msg: string, ms = 5000) => {
    setToast(msg);
    window.setTimeout(() => setToast((t) => (t === msg ? null : t)), ms);
  }, []);

  const goPage = useCallback((p: number) => {
    const n = Math.max(0, Math.min(LAST, p));
    setPage(n);
    setSeen((s) => new Set(s).add(n));
    setView({ kind: "page" });
    setRailOpen(false);
  }, []);
  const openItem = useCallback((id: string) => {
    setView({ kind: "item", id });
    setRailOpen(false);
  }, []);
  const prev = () => (view.kind === "page" ? goPage(page - 1) : goPage(page));
  const next = () => goPage(page + 1);

  const pickHere = (): Pick => {
    if (item) return pickItem(full, item.id);
    if (view.kind === "answer") return { key: `answer:${view.question}`, kind: "answer", name: view.question, detail: view.card.summary, urls: [] };
    if (pageGroup !== null) return pickGroup(atlas, pageGroup, scope);
    return {
      key: `overview:${scope ?? "all"}`,
      kind: "overview",
      name: scope ? `${full.title}, ${scope}` : full.title,
      detail: `${atlas.items.length} ${full.noun[1]}. ${atlas.groups.map((g) => `${g.name} ${g.count}`).join("; ")}.`,
      urls: [full.source.url],
    };
  };
  const added = picks.some((p) => p.key === pickHere().key);

  /** Hand data to the viewer's chat. Must run inside the click: the platform checks the gesture. */
  const handOff = (data: { [k: string]: Json }, deliver: "stage" | "send", done: string) => {
    const room = roomRef.current;
    if (room && CHAT_READY.includes(canSend)) {
      const mode = canSend === "available_if_summoned" ? "send" : canSend === "available_if_opened" ? "stage" : deliver;
      room
        .sendToClaudeSession(data, { deliver: mode })
        .then(() => flash(mode === "send" ? "Sent. Claude answers in your chat." : done))
        .catch(() => {
          refreshCan();
          flash("Couldn't reach your chat just now. Try again.");
        });
      return;
    }
    navigator.clipboard
      .writeText(asText(data))
      .then(() => flash("Copied. Paste it into Claude: this view can't reach your chat directly.", 7000))
      .catch(() => flash("Open this atlas in Claude to hand things to your chat."));
  };

  const context = { page: pageLabel, scope };
  const add = () => {
    if (added) return;
    const next = [...picks, pickHere()];
    setPicks(next);
    // Beside an open chat, keep the composer's attachment in step with the tray.
    if (roomRef.current && canSend === "available") handOff(payload(full, next, context), "stage", `Added. Your chat has all ${next.length} as one attachment.`);
    else flash(`Added (${next.length}). Send them to your chat when you're ready.`);
  };
  const sendPicks = () => handOff(payload(full, picks, context), "stage", "In your chat as one attachment. Ask your question there.");
  const ask = (question: string) => handOff(payload(full, picks, context, question), "send", "In your chat. Press send to ask.");

  const facts = quickFacts(atlas, ctx);
  const showFact = (label: string) => {
    const f = facts.find((x) => x.label === label);
    const where = [ctx.group !== null ? full.groups[ctx.group].short : null, scope].filter(Boolean).join(", ");
    if (f) setView({ kind: "answer", ctx: { group: ctx.group, item: null }, question: where ? `${f.label} · ${where}` : f.label, card: f.card });
  };

  // ← → page, A add, Esc back.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
      if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key.toLowerCase() === "a" && !e.metaKey && !e.ctrlKey) add();
      else if (e.key === "Escape" && view.kind !== "page") goPage(page);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const highlight = useMemo(() => (view.kind === "answer" && view.card.highlight.length ? new Set(view.card.highlight) : null), [view]);
  const aside = (
    <Continue
      picks={picks}
      questions={questions(atlas, ctx, scope)}
      quick={facts.map((f) => f.label)}
      route={route}
      onRemove={(key) => setPicks((ps) => ps.filter((p) => p.key !== key))}
      onSend={sendPicks}
      onAsk={ask}
      onQuick={showFact}
    />
  );
  const nav = { onItem: openItem, onAdd: add, added, aside };

  return (
    <div className="app">
      <header className="top">
        <nav className="crumbs" aria-label="Breadcrumb">
          <button className={view.kind === "page" && page === 0 ? "cur" : ""} onClick={() => goPage(0)}>{full.title}</button>
          {(view.kind !== "page" || page > 0) && ctx.group !== null && (
            <>
              <i>/</i>
              <button className={view.kind === "page" ? "cur" : ""} onClick={() => goPage(ctx.group! + 1)}>{full.groups[ctx.group].short}</button>
            </>
          )}
          {item && (
            <>
              <i>/</i>
              <span className="cur">{item.name}</span>
            </>
          )}
        </nav>
        {full.filter && (
          <div className="seg" role="radiogroup" aria-label={full.filter.label}>
            {[null, ...full.filter.values].map((v) => (
              <button key={v ?? "all"} role="radio" aria-checked={scope === v} className={scope === v ? "on" : ""} onClick={() => setScope(v)} title={v ?? `All ${full.filter!.label.toLowerCase()}es`}>
                {v ? v.split(" ")[0] : "All"}
              </button>
            ))}
          </div>
        )}
        <div className="top-actions">
          <button className="round small" onClick={prev} disabled={view.kind === "page" && page === 0} aria-label="Previous (←)" title="Previous (←)">
            <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3 5 8l5 5" fill="none" stroke="currentColor" strokeWidth="1.8" /></svg>
          </button>
          <button className="round next" onClick={next} disabled={page >= LAST && view.kind === "page"} title="Next (→)">
            <span>{page < LAST ? `Next: ${full.groups[page].short}` : "End"}</span>
            <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden="true"><path d="m6 3 5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.8" /></svg>
          </button>
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

      <main className={`stage ${view.kind === "page" && page === 0 ? "solo" : ""}`}>
        <section className="scene" aria-live="polite">
          <div className="scene-scroll">
            <div className="fit">
              {view.kind === "page" && page === 0 && <OverviewScene atlas={atlas} full={full} onGroup={(g) => goPage(g + 1)} {...nav} />}
              {view.kind === "page" && page > 0 && <GroupScene atlas={atlas} full={full} group={page - 1} {...nav} />}
              {view.kind === "item" && <ItemScene atlas={full} id={view.id} {...nav} />}
              {view.kind === "answer" && <AnswerScene atlas={atlas} answer={view} {...nav} />}
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

      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
