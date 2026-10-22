// The one thing on screen. Each scene is readable at a glance and fits the stage.
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
    <div className="scene-body" key="overview">
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
        Groups are an editorial read of each company's own YC one-liner. A company joins a group only when its one-liner contains a supporting phrase, highlighted on its page. Source:{" "}
        <a href={atlas.source} target="_blank" rel="noopener noreferrer">YC directory</a>, snapshot {atlas.snapshotDate}.
      </p>
    </div>
  );
}

export function GroupScene({ atlas, group, onCompany, onNote }: { atlas: Atlas; group: number; onCompany: (s: string) => void; onNote: () => void }) {
  const g = atlas.groups[group];
  const members = inGroup(atlas, group);
  return (
    <div className="scene-body" key={g.id}>
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
      <div className="tiles">
        {members.map((c) => (
          <button key={c.slug} className="tile" onClick={() => onCompany(c.slug)} title={c.oneLiner}>
            <b>
              {c.name}
              {!c.evidence && <span className="tag">judgment call</span>}
            </b>
            <small>
              <Evidence c={c} />
            </small>
          </button>
        ))}
      </div>
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
