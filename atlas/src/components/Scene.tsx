// The one thing on screen. Each scene is readable at a glance and fits the stage.
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { Card } from "../../shared/card";
import { inGroup } from "../../shared/dataset";
import { ycProfileUrl, type Atlas, type Company } from "../../shared/types";
import { AtlasMap } from "./AtlasMap";
import { CardView } from "./CardView";

export type AnswerState = {
  question: string;
  status: "running" | "done" | "error";
  steps: string[];
  card?: Card;
  error?: string;
  /** Set when the answer could go deeper with a web search. */
  canResearch?: boolean;
};

function Evidence({ c }: { c: Company }) {
  if (!c.evidence) return <>{c.oneLiner}</>;
  const [a, b] = c.evidence;
  return (
    <>
      {c.oneLiner.slice(0, a)}
      <span className="ev">{c.oneLiner.slice(a, b)}</span>
      {c.oneLiner.slice(b)}
    </>
  );
}

function NoteButton({ onNote }: { onNote: () => void }) {
  return (
    <button className="btn" onClick={onNote} title="Save to notes (N)">
      + Note
    </button>
  );
}

export function OverviewScene({ atlas, onGroup, onCompany, onNote }: { atlas: Atlas; onGroup: (g: number) => void; onCompany: (s: string) => void; onNote: () => void }) {
  const grouped = atlas.companies.filter((c) => c.group >= 0).length;
  return (
    <div className="scene-body fill overview" key="overview">
      <div className="scene-head">
        <span className="label">Briefing · {atlas.groups.length + 1} pages</span>
        <NoteButton onNote={onNote} />
      </div>
      <h1>YC {atlas.batch}</h1>
      <p className="lead">{atlas.overview.replace(/ The tour takes.*$/, "")}</p>
      <div className="stats">
        <div className="stat"><b>{atlas.companies.length}</b><span>companies</span></div>
        <div className="stat"><b>{grouped}</b><span>in {atlas.groups.length} groups</span></div>
        <div className="stat"><b>{atlas.companies.length - grouped}</b><span>ungrouped</span></div>
      </div>
      <div className="overview-grid">
        <AtlasMap atlas={atlas} focus={null} selected={null} highlight={null} big onCompany={onCompany} onGroup={onGroup} />
        <div className="glist">
          {atlas.groups.map((g, i) => (
            <button key={g.id} className="grow" onClick={() => onGroup(i)}>
              <span className="n num">{g.count}</span>
              <span className="gh">{g.name}</span>
            </button>
          ))}
        </div>
      </div>
      <p className="fine">
        Groups come from each company's own YC one-liner. Source: <a href={atlas.source} target="_blank" rel="noopener noreferrer">YC directory</a>, {atlas.snapshotDate}.
      </p>
    </div>
  );
}

export function GroupScene({ atlas, group, onCompany, onNote }: { atlas: Atlas; group: number; onCompany: (s: string) => void; onNote: () => void }) {
  const g = atlas.groups[group];
  const members = inGroup(atlas, group);
  return (
    <div className="scene-body fill group" key={g.id}>
      <div className="intro">
      <div className="scene-head">
        <span className="label">Group {group + 1} of {atlas.groups.length}</span>
        <NoteButton onNote={onNote} />
      </div>
      <h1>{g.name}</h1>
      <p className="lead">{g.narration}</p>
      <div className="stats">
        <div className="stat"><b>{g.count}</b><span>companies</span></div>
        <div className="stat"><b>{g.medianTeam}</b><span>median team</span></div>
        <div className="stat"><b>{members.filter((c) => c.city === "San Francisco").length}</b><span>in San Francisco</span></div>
      </div>
      </div>
      <FitTiles
        count={members.length}
        render={(i) => {
          const c = members[i];
          return (
            <button key={c.slug} className="tile" onClick={() => onCompany(c.slug)} title={c.oneLiner}>
              <b>
                {c.name}
                {!c.evidence && <span className="tag">judgment call</span>}
              </b>
              <small>
                <Evidence c={c} />
              </small>
            </button>
          );
        }}
      />
    </div>
  );
}

export function CompanyScene({ atlas, slug, onCompany, onNote }: { atlas: Atlas; slug: string; onCompany: (s: string) => void; onNote: () => void }) {
  const c = atlas.companies.find((x) => x.slug === slug)!;
  const neighbours = c.group < 0 ? [] : inGroup(atlas, c.group).filter((x) => x.slug !== slug).slice(0, 6);
  return (
    <div className="scene-body" key={slug}>
      <div className="scene-head">
        <span className="label">{c.group < 0 ? "Ungrouped" : atlas.groups[c.group].name}</span>
        <NoteButton onNote={onNote} />
      </div>
      <h1>{c.name}</h1>
      <p className="summary">
        <Evidence c={c} />
      </p>
      {c.description && <p className="lead" style={{ fontSize: 15.5 }}>{c.description}</p>}
      <div className="kv">
        <div><small>Team</small><b>{c.teamSize ? `${c.teamSize} people` : "Not listed"}</b></div>
        <div><small>Location</small><b>{c.location}</b></div>
        {c.founders.length > 0 && <div><small>Founders</small><b>{c.founders.join(", ")}</b></div>}
      </div>
      <div className="row" style={{ fontSize: 13 }}>
        <a href={ycProfileUrl(c.slug)} target="_blank" rel="noopener noreferrer">YC profile ↗</a>
        {c.website && <a href={c.website} target="_blank" rel="noopener noreferrer">Website ↗</a>}
        <span className="fine">From the company's YC profile. Funding isn't part of it.</span>
      </div>
      {neighbours.length > 0 && (
        <>
          <div className="label">Same group</div>
          <div className="tiles">
            {neighbours.map((n) => (
              <button key={n.slug} className="tile" onClick={() => onCompany(n.slug)}>
                <b>{n.name}</b>
                <small>{n.oneLiner}</small>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

type AnswerProps = {
  atlas: Atlas;
  answer: AnswerState;
  onCompany: (s: string) => void;
  onNote: () => void;
  onResearch: () => void;
};

export function AnswerScene({ atlas, answer, onCompany, onNote, onResearch }: AnswerProps) {
  return (
    <div className="scene-body" key={answer.question}>
      <div className="scene-head">
        <span className="label">{answer.card ? (answer.card.tier === "dataset" ? "Answer · from the snapshot" : "Answer · from the web") : "Answer"}</span>
        {answer.card && <NoteButton onNote={onNote} />}
      </div>
      <h1 style={{ fontSize: "clamp(20px, 2.4vw, 28px)" }}>{answer.question}</h1>
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
      {answer.card && <CardView atlas={atlas} card={answer.card} onCompany={onCompany} />}
      {answer.status !== "running" && answer.canResearch && (
        <div className="box row" style={{ justifyContent: "space-between" }}>
          <span style={{ fontSize: 13.5 }}>{answer.card?.needsWeb ?? "The snapshot can't answer this."} Add it to your notes and Claude researches it on the web when you send them.</span>
          <button className="btn primary" onClick={onResearch}>Add to research notes</button>
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
          <button className="round small" onClick={() => setSet(current - 1)} disabled={current === 0} aria-label="Previous companies">
            <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3 5 8l5 5" fill="none" stroke="currentColor" strokeWidth="1.8" /></svg>
          </button>
          <button className="round small" onClick={() => setSet(current + 1)} disabled={current === sets - 1} aria-label="More companies">
            <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden="true"><path d="m6 3 5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.8" /></svg>
          </button>
        </div>
      )}
    </div>
  );
}
