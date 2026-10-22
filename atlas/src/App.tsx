import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import atlasJson from "../shared/atlas.generated.json";
import type { Tier } from "../shared/tiers";
import { ycProfileUrl, type Atlas } from "../shared/types";
import { AskBar } from "./components/AskBar";
import { AtlasMap } from "./components/AtlasMap";
import { AnswerView, CompanyView, GroupView, Notes, Overview, type AnswerState } from "./components/Panel";
import { Transport } from "./components/Transport";
import { ask, getHealth, handoff, OFFLINE, type Health } from "./lib/api";
import { agentBrief, loadNotes, newNote, notesMarkdown, saveNotes, type Note } from "./lib/notes";
import { route, suggestions, type Context } from "./lib/router";
import { canListen, listen, loadManifest, speakAnswer, stopAnswer, type VoiceManifest } from "./lib/voice";
import { ARTIFACT, getDownloads, getSample, type Sample } from "./lib/env";
import { askClaude } from "./lib/sampleAsk";

const atlas = atlasJson as Atlas;
const CH = 20; // seconds per chapter when there is no recorded narration
const CHAPTERS = atlas.groups.length + 1;
const TOTAL = CH * CHAPTERS;
const LABELS = ["Overview", ...atlas.groups.map((g) => g.name)];
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

type View =
  | { kind: "tour" }
  | { kind: "company"; slug: string }
  | ({ kind: "answer"; id: number; tier: Tier; ctx: Context } & AnswerState);

export default function App() {
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [view, setView] = useState<View>({ kind: "tour" });
  const [notes, setNotes] = useState<Note[]>(loadNotes);
  const [dark, setDark] = useState(() => document.documentElement.dataset.theme === "dark");
  const [health, setHealth] = useState<Health>(OFFLINE);
  const [manifest, setManifest] = useState<VoiceManifest | null>(null);
  const [listening, setListening] = useState(false);
  const [sound, setSound] = useState(true);
  const [askText, setAskText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const answerSeq = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const stopListening = useRef<(() => void) | null>(null);
  const sideRef = useRef<HTMLElement>(null);
  const sampleRef = useRef<Sample | null>(null);

  const chapter = Math.min(CHAPTERS - 1, Math.floor(t / CH));
  const within = t >= TOTAL ? 1 : Math.max(0, Math.min(1, (t - chapter * CH) / CH));
  const tourGroup = chapter > 0 ? chapter - 1 : null;
  const company = view.kind === "company" ? atlas.companies.find((c) => c.slug === view.slug)! : null;
  const ctx: Context =
    view.kind === "answer" ? view.ctx : company ? { group: company.group >= 0 ? company.group : null, company: company.slug } : { group: tourGroup, company: null };

  useEffect(() => {
    if (ARTIFACT) {
      // Live questions run on the viewer's own Claude plan; nothing else is served.
      getSample().then((sample) => {
        sampleRef.current = sample;
        setHealth({ ...OFFLINE, answers: !!sample });
      });
      return;
    }
    getHealth().then(setHealth);
    loadManifest().then(setManifest);
  }, []);
  useEffect(() => saveNotes(notes), [notes]);
  useEffect(() => {
    if (ARTIFACT) return; // the Claude viewer owns the theme
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    try {
      localStorage.setItem("bs-theme", dark ? "dark" : "light");
    } catch {
      /* preference just won't persist */
    }
  }, [dark]);

  // Captions-only tour clock.
  useEffect(() => {
    if (!playing || view.kind !== "tour" || manifest) return;
    const id = setInterval(() => {
      setT((prev) => {
        const next = Math.min(TOTAL, prev + 0.25);
        if (next >= TOTAL) setPlaying(false);
        return next;
      });
    }, 250);
    return () => clearInterval(id);
  }, [playing, view.kind, manifest]);

  // Recorded narration drives the clock when available.
  useEffect(() => {
    if (!manifest) return;
    audioRef.current ??= new Audio();
    const a = audioRef.current;
    a.muted = !sound;
    if (!playing || view.kind !== "tour") {
      a.pause();
      return;
    }
    const src = `/voice/${manifest.chapters[chapter]}`;
    if (!a.src.endsWith(src)) a.src = src;
    a.ontimeupdate = () => a.duration && setT(chapter * CH + Math.min(0.999, a.currentTime / a.duration) * CH);
    a.onended = () => {
      if (chapter < CHAPTERS - 1) setT((chapter + 1) * CH);
      else {
        setT(TOTAL);
        setPlaying(false);
      }
    };
    a.play().catch(() => setPlaying(false));
  }, [manifest, playing, view.kind, chapter, sound]);

  // On narrow screens the panel sits below the map; bring new answers into view.
  const viewKey = view.kind === "answer" ? `a${view.id}` : view.kind === "company" ? view.slug : "tour";
  useEffect(() => {
    const el = sideRef.current;
    if (!el || viewKey === "tour") return;
    if (el.getBoundingClientRect().top > window.innerHeight * 0.6) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [viewKey]);

  const interrupt = () => {
    setPlaying(false);
    stopAnswer();
    abortRef.current?.abort();
  };
  const goGroup = useCallback((g: number) => {
    interrupt();
    setView({ kind: "tour" });
    setT((g + 1) * CH);
    setPlaying(true);
  }, []);
  const goHome = () => {
    interrupt();
    setView({ kind: "tour" });
    setT(0);
  };
  const openCompany = useCallback((slug: string) => {
    interrupt();
    setView({ kind: "company", slug });
  }, []);
  const resume = () => {
    interrupt();
    setView({ kind: "tour" });
    setPlaying(true);
  };
  const toggle = () => {
    stopAnswer();
    if (view.kind !== "tour") return resume();
    if (t >= TOTAL) setT(0);
    setPlaying((p) => !p);
  };
  const jump = (c: number) => {
    interrupt();
    setView({ kind: "tour" });
    setT(c * CH);
    setPlaying(true);
  };

  const say = (text: string) => {
    if (sound && health.voice) speakAnswer(text);
  };

  const addNote = (note: Note) => setNotes((ns) => [...ns, note]);

  const pinCurrent = () => {
    if (view.kind === "company" && company) {
      addNote(newNote(`${company.name}: ${company.oneLiner}`, "Company · YC profile", [ycProfileUrl(company.slug)]));
    } else if (view.kind === "answer" && view.card) {
      addNote(newNote(`${view.question} — ${view.card.summary}`, `Answer · ${view.card.tier}`, view.card.sources.map((s) => s.url)));
    } else if (tourGroup !== null) {
      const g = atlas.groups[tourGroup];
      addNote(newNote(`${g.name}: ${g.count} companies, median team ${g.medianTeam}`, "Group · dataset"));
    } else {
      const grouped = atlas.companies.filter((c) => c.group >= 0).length;
      addNote(newNote(`YC ${atlas.batch}: ${atlas.companies.length} companies, ${grouped} in ${atlas.groups.length} groups`, "Overview · dataset"));
    }
  };

  const sendToAgent = async (note: Note) => {
    if (ARTIFACT) {
      // No server here: copy the brief while still inside the click.
      let status: Note["status"] = "open";
      try {
        await navigator.clipboard.writeText(agentBrief(note, atlas.batch));
        status = "copied";
      } catch {
        status = "open";
      }
      return setNotes((ns) => ns.map((n) => (n.id === note.id ? { ...n, status } : n)));
    }
    const result = await handoff(agentBrief(note, atlas.batch), ctx, note.sources);
    let status: Note["status"] = "sent";
    if (result !== "sent") {
      try {
        await navigator.clipboard.writeText(agentBrief(note, atlas.batch));
        status = "copied";
      } catch {
        status = "open";
      }
    }
    setNotes((ns) => ns.map((n) => (n.id === note.id ? { ...n, status } : n)));
  };

  const handoffCurrent = () => {
    const subject = company ? company.name : ctx.group !== null ? `the ${atlas.groups[ctx.group].name} group` : `YC ${atlas.batch}`;
    const sources = company ? [ycProfileUrl(company.slug), ...(company.website ? [company.website] : [])] : [];
    const note = newNote(`Research funding, launches and press coverage for ${subject}.`, "Agent task", sources);
    addNote(note);
    sendToAgent(note);
  };

  const runRemote = async (question: string, tier: "official" | "web", context: Context) => {
    interrupt();
    const id = ++answerSeq.current;
    const controller = new AbortController();
    abortRef.current = controller;
    setView({ kind: "answer", id, tier, ctx: context, question, status: "running", steps: [] });
    const update = (fn: (v: Extract<View, { kind: "answer" }>) => Partial<View>) =>
      setView((v) => (v.kind === "answer" && v.id === id ? ({ ...v, ...fn(v) } as View) : v));
    const events =
      ARTIFACT && sampleRef.current
        ? askClaude(sampleRef.current, atlas, question, context, controller.signal)
        : ask(question, tier, context, controller.signal);
    for await (const event of events) {
      if (event.type === "step") update((v) => ({ steps: [...v.steps, event.label] }));
      else if (event.type === "card") {
        update(() => ({ status: "done", card: event.card }));
        say(event.card.summary);
      } else update(() => ({ status: "error", error: event.message }));
    }
  };

  const handleInput = (text: string) => {
    const question = text.trim();
    if (!question) return;
    setAskText("");
    const action = route(atlas, question, ctx);
    switch (action.kind) {
      case "play":
        return resume();
      case "pause":
        return interrupt();
      case "next":
        return jump(Math.min(CHAPTERS - 1, chapter + 1));
      case "prev":
        return jump(Math.max(0, chapter - 1));
      case "home":
        return goHome();
      case "group":
        return goGroup(action.group);
      case "company":
        return openCompany(action.slug);
      case "pin":
        return pinCurrent();
      case "handoff":
        return handoffCurrent();
      case "theme":
        return setDark(action.dark ?? !dark);
      case "card":
        interrupt();
        setView({ kind: "answer", id: ++answerSeq.current, tier: "dataset", ctx, question, status: "done", steps: [], card: action.card });
        return say(action.card.summary);
      case "remote":
        if (!health.answers) {
          interrupt();
          return setView({
            kind: "answer",
            id: ++answerSeq.current,
            tier: action.tier,
            ctx,
            question,
            status: "error",
            steps: [],
            error: "Live answers aren't switched on for this server. The snapshot can still answer questions about groups, teams and locations.",
          });
        }
        if (action.tier === "web" && ARTIFACT) {
          interrupt();
          return setView({
            kind: "answer",
            id: ++answerSeq.current,
            tier: "web",
            ctx,
            question,
            status: "done",
            steps: [],
            card: {
              summary: "Web search isn't part of this edition. Add the question to your notes and hand it to an agent, or ask what the snapshot says.",
              tier: "dataset",
              blocks: [],
              sources: [],
              notStated: [],
              highlight: [],
            },
          });
        }
        if (action.tier === "web") {
          interrupt();
          return setView({ kind: "answer", id: ++answerSeq.current, tier: "web", ctx, question, status: "confirm", steps: [] });
        }
        return runRemote(question, "official", ctx);
    }
  };

  const onMic = () => {
    if (listening) return stopListening.current?.();
    setPlaying(false);
    stopAnswer();
    const { result, stop } = listen();
    stopListening.current = stop;
    setListening(true);
    result.then((heard) => {
      setListening(false);
      stopListening.current = null;
      if (heard) handleInput(heard);
    });
  };

  // Space plays and pauses, "/" jumps to the question box, Escape returns to the tour.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(e.target.tagName);
      if (e.key === " " && !typing) {
        e.preventDefault();
        toggle();
      } else if (e.key === "/" && !typing) {
        e.preventDefault();
        inputRef.current?.focus();
      } else if (e.key === "Escape" && view.kind !== "tour") {
        resume();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const narration = chapter === 0 ? atlas.overview : atlas.groups[chapter - 1].narration;
  const words = narration.split(" ");
  const shown = Math.min(words.length, Math.ceil(words.length * Math.min(1, within * 1.15)));
  const highlight = useMemo(
    () => (view.kind === "answer" && view.card?.highlight.length ? new Set(view.card.highlight) : null),
    [view],
  );
  const mapFocus = view.kind === "tour" ? tourGroup : ctx.group;
  const tag =
    view.kind === "answer" ? "Answer" : company ? company.name : chapter === 0 ? "Overview" : `${String(chapter).padStart(2, "0")} / ${String(CHAPTERS - 1).padStart(2, "0")} · ${atlas.groups[chapter - 1].name}`;
  const status = listening
    ? "Listening…"
    : playing && view.kind === "tour"
      ? manifest
        ? "Narrating"
        : "Narrating · captions"
      : t >= TOTAL
        ? "Tour complete"
        : "Paused";
  const activeTier = view.kind === "answer" ? (view.card?.tier ?? view.tier) : view.kind === "company" ? "dataset" : "tour";
  const placeholder = company
    ? `Ask about ${company.name}…`
    : ctx.group !== null
      ? `Ask about ${atlas.groups[ctx.group].name.toLowerCase()}…`
      : "Ask about the batch, or say a company name…";
  const crumbGroup = company ? (company.group >= 0 ? company.group : null) : ctx.group;

  return (
    <>
      <header className="top">
        <div className="brand">
          <b>Batch Signal</b>
          <span className="mono">YC {atlas.batch}</span>
        </div>
        <div className="top-right">
          <a className="mono" href={atlas.source} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
            Source: YC directory · snapshot {atlas.snapshotDate}
          </a>
          {!ARTIFACT && (
            <>
              <button className="btn" onClick={() => setSound(!sound)} aria-pressed={!sound}>
                {sound ? "Sound on" : "Sound off"}
              </button>
              <button className="btn" onClick={() => setDark(!dark)} aria-label={`Switch to ${dark ? "light" : "dark"} mode`}>
                {dark ? "Light" : "Dark"}
              </button>
            </>
          )}
        </div>
      </header>

      <main className="main">
        <section className="stage" aria-label="Map and tour">
          <AtlasMap atlas={atlas} focus={mapFocus} selected={company?.slug ?? null} highlight={highlight} tag={tag} onCompany={openCompany} onGroup={goGroup} />
          <Transport
            labels={LABELS}
            chapter={chapter}
            within={within}
            playing={playing && view.kind === "tour"}
            narrating={playing && view.kind === "tour" && !listening}
            status={status}
            clock={`${fmt(t)} / ${fmt(TOTAL)}`}
            spoken={words.slice(0, shown).join(" ")}
            rest={words.slice(shown).join(" ")}
            onToggle={toggle}
            onJump={jump}
          />
          <AskBar
            ref={inputRef}
            value={askText}
            placeholder={placeholder}
            chips={suggestions(atlas, ctx, !ARTIFACT)}
            activeTier={activeTier}
            listening={listening}
            canListen={!ARTIFACT && canListen()}
            showMic={!ARTIFACT}
            onChange={setAskText}
            onSubmit={() => handleInput(askText)}
            onChip={handleInput}
            onMic={onMic}
          />
        </section>

        <aside className="side" aria-label="Detail panel" ref={sideRef}>
          <nav className="crumbs" aria-label="Breadcrumb">
            <button className={`crumb ${view.kind === "tour" && tourGroup === null ? "cur" : ""}`} onClick={goHome}>
              All {atlas.companies.length}
            </button>
            {crumbGroup !== null && (
              <button className={`crumb ${view.kind === "tour" ? "cur" : ""}`} onClick={() => goGroup(crumbGroup)}>
                {atlas.groups[crumbGroup].short}
              </button>
            )}
            {company && <span className="crumb cur">{company.name}</span>}
          </nav>

          {view.kind === "tour" && tourGroup === null && <Overview atlas={atlas} onGroup={goGroup} />}
          {view.kind === "tour" && tourGroup !== null && <GroupView atlas={atlas} group={tourGroup} onCompany={openCompany} onPin={pinCurrent} />}
          {view.kind === "company" && <CompanyView atlas={atlas} slug={view.slug} onCompany={openCompany} onPin={pinCurrent} />}
          {view.kind === "answer" && (
            <AnswerView
              atlas={atlas}
              answer={view}
              webHint={`Up to 5 searches on allowlisted outlets and official sources${health.search === "exa" ? " (Exa)" : ""}, about 30 seconds.`}
              onCompany={openCompany}
              webAvailable={!ARTIFACT}
              onRunWeb={() => runRemote(view.question, "web", view.ctx)}
              onPin={pinCurrent}
              onResume={resume}
            />
          )}

          <Notes
            notes={notes}
            onHandoff={(id) => {
              const n = notes.find((x) => x.id === id);
              if (n) sendToAgent(n);
            }}
            onRemove={(id) => setNotes((ns) => ns.filter((n) => n.id !== id))}
            onExport={async () => {
              if (ARTIFACT) {
                const downloads = await getDownloads();
                await downloads?.save({ filename: "batch-signal-notes.md", data: notesMarkdown(notes, atlas.batch) }).catch(() => {});
                return;
              }
              const blob = new Blob([notesMarkdown(notes, atlas.batch)], { type: "text/markdown" });
              const a = document.createElement("a");
              a.href = URL.createObjectURL(blob);
              a.download = "batch-signal-notes.md";
              a.click();
              URL.revokeObjectURL(a.href);
            }}
          />
        </aside>
      </main>
    </>
  );
}
