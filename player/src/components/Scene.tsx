// The one thing on screen. Each scene is readable at a glance and fits the stage.
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { Card } from "../../shared/card";
import { groupMedian, inGroup, placeCounts } from "../../shared/dataset";
import { factOf, formatFact, type Atlas, type Item } from "../../shared/types";
import { AtlasMap } from "./AtlasMap";
import { CardView } from "./CardView";

export type AnswerState = {
  question: string;
  status: "running" | "done" | "error";
  steps: string[];
  card?: Card;
  error?: string;
  /** Set when the answer needs sources beyond the atlas. */
  canResearch?: boolean;
};

type Nav = { onItem: (id: string) => void; onNote: () => void };

function Evidence({ it }: { it: Item }) {
  if (!it.evidence) return <>{it.summary}</>;
  const [a, b] = it.evidence;
  return (
    <>
      {it.summary.slice(0, a)}
      <span className="ev">{it.summary.slice(a, b)}</span>
      {it.summary.slice(b)}
    </>
  );
}

function NoteButton({ onNote }: { onNote: () => void }) {
  return (
    <button className="btn" onClick={onNote} title="Leave a note for Claude to research (N)">
      + Note
    </button>
  );
}

function Head({ title, label, onNote }: { title: string; label?: string; onNote: () => void }) {
  return (
    <div className="head">
      <div>
        {label && <span className="label">{label}</span>}
        <h1>{title}</h1>
      </div>
      <NoteButton onNote={onNote} />
    </div>
  );
}

export function OverviewScene({ atlas, onGroup, onItem, onNote }: { atlas: Atlas; onGroup: (g: number) => void } & Nav) {
  return (
    <div className="scene-body fill overview" key="overview">
      <div className="overview-side">
        <Head title={atlas.title} onNote={onNote} />
        <p className="lead">{atlas.overview}</p>
        <nav className="toc" aria-label="Groups">
          {atlas.groups.map((g, i) => (
            <button key={g.id} onClick={() => onGroup(i)}>
              <span className="k num">{String(i + 1).padStart(2, "0")}</span>
              <span>{g.name}</span>
              <span className="c num">{g.count}</span>
            </button>
          ))}
        </nav>
        <p className="fine">
          Source: <a href={atlas.source.url} target="_blank" rel="noopener noreferrer">{atlas.source.name}</a>, {atlas.source.checked}.
        </p>
      </div>
      <div className="overview-map">
        <AtlasMap atlas={atlas} focus={null} selected={null} highlight={null} big onItem={onItem} onGroup={onGroup} />
      </div>
    </div>
  );
}

export function GroupScene({ atlas, group, onItem, onNote }: { atlas: Atlas; group: number } & Nav) {
  const g = atlas.groups[group];
  const members = inGroup(atlas, group);
  const num = factOf(atlas, "number");
  const place = factOf(atlas, "place");
  const top = place ? placeCounts(atlas, group, place.key)[0] : null;
  return (
    <div className="scene-body fill group" key={g.id}>
      <div className="intro">
        <Head title={g.name} label={`Group ${group + 1} of ${atlas.groups.length}`} onNote={onNote} />
        <p className="lead">{g.narration}</p>
        {(num || (top && top[0] !== "Not listed")) && (
          <div className="stats">
            {num && <div className="stat"><b>{groupMedian(atlas, group, num.key)}</b><span>median {num.label.toLowerCase()}</span></div>}
            {top && top[0] !== "Not listed" && <div className="stat"><b>{top[1]}</b><span>in {top[0]}</span></div>}
          </div>
        )}
      </div>
      <FitTiles
        count={members.length}
        render={(i) => {
          const it = members[i];
          return (
            <button key={it.id} className="tile" onClick={() => onItem(it.id)} title={it.summary}>
              <b>
                {it.name}
                {!it.evidence && <span className="tag">judgment call</span>}
              </b>
              <small>
                <Evidence it={it} />
              </small>
            </button>
          );
        }}
      />
    </div>
  );
}

export function ItemScene({ atlas, id, onItem, onNote }: { atlas: Atlas; id: string } & Nav) {
  const it = atlas.items.find((x) => x.id === id)!;
  const neighbours = it.group < 0 ? [] : inGroup(atlas, it.group).filter((x) => x.id !== id).slice(0, 6);
  const facts = atlas.facts.filter((f) => it.facts[f.key] !== undefined);
  return (
    <div className="scene-body" key={id}>
      <Head title={it.name} label={it.group < 0 ? "Ungrouped" : atlas.groups[it.group].name} onNote={onNote} />
      <p className="summary">
        <Evidence it={it} />
      </p>
      {it.description && <p className="lead" style={{ fontSize: 15.5 }}>{it.description}</p>}
      {facts.length > 0 && (
        <div className="kv">
          {facts.map((f) => (
            <div key={f.key}><small>{f.label}</small><b>{formatFact(f, it.facts[f.key])}</b></div>
          ))}
        </div>
      )}
      <div className="row" style={{ fontSize: 13 }}>
        {it.url && <a href={it.url} target="_blank" rel="noopener noreferrer">{atlas.source.name} ↗</a>}
        {it.links.map((l) => (
          <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer">{l.label} ↗</a>
        ))}
        <span className="fine">As listed on {atlas.source.checked}.</span>
      </div>
      {neighbours.length > 0 && (
        <>
          <div className="label">Same group</div>
          <div className="tiles">
            {neighbours.map((n) => (
              <button key={n.id} className="tile" onClick={() => onItem(n.id)}>
                <b>{n.name}</b>
                <small>{n.summary}</small>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function AnswerScene({ atlas, answer, onItem, onNote }: { atlas: Atlas; answer: AnswerState } & Nav) {
  return (
    <div className="scene-body" key={answer.question}>
      <Head title={answer.question} label={answer.card ? "Answer · from the atlas" : "Answer"} onNote={onNote} />
      {answer.status === "running" && (
        <div className="steps" aria-live="polite">
          {(answer.steps.length ? answer.steps : ["Thinking…"]).map((s, i, all) => (
            <div key={i} className={`step ${i === all.length - 1 ? "run" : ""}`}>
              <i />
              {s}
            </div>
          ))}
        </div>
      )}
      {answer.status === "error" && <p className="summary err">{answer.error}</p>}
      {answer.card && <CardView atlas={atlas} card={answer.card} onItem={onItem} />}
      {answer.status !== "running" && answer.canResearch && (
        <div className="box row" style={{ justifyContent: "space-between" }}>
          <span style={{ fontSize: 13.5 }}>{answer.card?.needsWeb ?? "The atlas can't answer this."} Leave it as a note and Claude researches it on the web.</span>
          <button className="btn primary" onClick={onNote}>Note it for research</button>
        </div>
      )}
    </div>
  );
}

/** Tiles that fill the space left in the scene. Extra tiles go to a next set, never a scrollbar. */
function FitTiles({ count, render }: { count: number; render: (i: number) => ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const [per, setPer] = useState(count);
  const [set, setSet] = useState(0);
  useLayoutEffect(() => {
    const el = box.current;
    const g = grid.current;
    if (!el || !g) return;
    const measure = () => {
      // Phones scroll naturally; paging only where there's room for a grid.
      if (window.innerWidth <= 600) return setPer(count);
      const cols = getComputedStyle(g).gridTemplateColumns.split(" ").filter(Boolean).length || 1;
      const tile = g.firstElementChild as HTMLElement | null;
      const rowH = (tile?.offsetHeight ?? 60) + 8;
      const pagerH = 34;
      let rows = Math.max(1, Math.floor((el.clientHeight + 8) / rowH));
      if (rows * cols < count) rows = Math.max(1, Math.floor((el.clientHeight - pagerH + 8) / rowH));
      setPer(Math.max(cols, rows * cols));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [count]);
  const sets = Math.max(1, Math.ceil(count / per));
  const current = Math.min(set, sets - 1);
  const start = current * per;
  const end = Math.min(count, start + per);
  return (
    <div className="tiles-fill" ref={box}>
      <div className="tiles" ref={grid}>
        {Array.from({ length: end - start }, (_, k) => render(start + k))}
      </div>
      {sets > 1 && (
        <div className="tiles-pager">
          <span className="label num">{start + 1}–{end} of {count}</span>
          <button className="round small" onClick={() => setSet(current - 1)} disabled={current === 0} aria-label="Previous set">
            <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3 5 8l5 5" fill="none" stroke="currentColor" strokeWidth="1.8" /></svg>
          </button>
          <button className="round small" onClick={() => setSet(current + 1)} disabled={current === sets - 1} aria-label="Next set">
            <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden="true"><path d="m6 3 5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.8" /></svg>
          </button>
        </div>
      )}
    </div>
  );
}
