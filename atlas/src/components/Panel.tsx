import { useState } from "react";
import type { Card } from "../../shared/card";
import { inGroup } from "../../shared/dataset";
import { ycProfileUrl, type Atlas, type Company } from "../../shared/types";
import type { Note } from "../lib/notes";
import { CardView } from "./CardView";

export type AnswerState = {
  question: string;
  status: "confirm" | "running" | "done" | "error";
  steps: string[];
  card?: Card;
  error?: string;
};

type Nav = { onCompany: (slug: string) => void; onGroup: (g: number) => void };

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

export function Overview({ atlas, onGroup }: { atlas: Atlas } & Pick<Nav, "onGroup">) {
  const [method, setMethod] = useState(false);
  const grouped = atlas.companies.filter((c) => c.group >= 0);
  const calls = grouped.filter((c) => !c.evidence).length;
  return (
    <div className="view">
      <h2>YC {atlas.batch}</h2>
      <div className="stats">
        <div className="stat"><b>{atlas.companies.length}</b><span>companies</span></div>
        <div className="stat"><b>{grouped.length}</b><span>in {atlas.groups.length} groups</span></div>
        <div className="stat"><b>{atlas.companies.length - grouped.length}</b><span>ungrouped</span></div>
      </div>
      <div>
        {atlas.groups.map((g, i) => (
          <button key={g.id} className="grow" onClick={() => onGroup(i)}>
            <span className="n num">{g.count}</span>
            <span className="gh">{g.name}</span>
          </button>
        ))}
      </div>
      <button className="link" style={{ alignSelf: "flex-start" }} onClick={() => setMethod(!method)}>
        {method ? "Hide method" : "How the groups were made"}
      </button>
      {method && (
        <div className="box method view">
          <p>
            A company joins a group only if its own YC one-liner contains a phrase that supports it. That phrase is <span className="ev">highlighted</span> in every list.
          </p>
          <p>
            {grouped.length - calls} of {grouped.length} placements have one. The other {calls} are marked <span className="tag" style={{ margin: 0 }}>judgment call</span>. Companies with no supporting phrase stay ungrouped.
          </p>
          <p>
            Method: <code>{atlas.classification}</code>. Re-run with <code>npm run classify</code> for two independent model passes with an agreement report.
          </p>
        </div>
      )}
    </div>
  );
}

export function GroupView({ atlas, group, onCompany, onPin }: { atlas: Atlas; group: number; onPin: () => void } & Pick<Nav, "onCompany">) {
  const g = atlas.groups[group];
  const members = inGroup(atlas, group);
  return (
    <div className="view" key={g.id}>
      <span className="mono">Group {group + 1} of {atlas.groups.length}</span>
      <h2>{g.name}</h2>
      <div className="stats">
        <div className="stat"><b>{g.count}</b><span>companies</span></div>
        <div className="stat"><b>{g.medianTeam}</b><span>median team</span></div>
        <div className="stat"><b>{members.filter((c) => c.city === "San Francisco").length}</b><span>in San Francisco</span></div>
      </div>
      <div className="row">
        <button className="btn" onClick={onPin}>+ Add to notes</button>
      </div>
      <div>
        <div className="mono">Companies · supporting phrase from YC profile</div>
        <div className="scroll">
          {members.map((c) => (
            <button key={c.slug} className="item" onClick={() => onCompany(c.slug)}>
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
    </div>
  );
}

export function CompanyView({ atlas, slug, onCompany, onPin }: { atlas: Atlas; slug: string; onPin: () => void } & Pick<Nav, "onCompany">) {
  const c = atlas.companies.find((x) => x.slug === slug)!;
  const neighbours = c.group < 0 ? [] : inGroup(atlas, c.group).filter((x) => x.slug !== slug).slice(0, 3);
  return (
    <div className="view" key={slug}>
      <span className="mono">{c.group < 0 ? "Ungrouped" : atlas.groups[c.group].name}</span>
      <h2 style={{ fontSize: 28 }}>{c.name}</h2>
      <p className="summary" style={{ fontWeight: 400, color: "var(--ink2)", fontSize: 17 }}>
        <Evidence c={c} />
      </p>
      {c.description && <p className="fine" style={{ fontSize: 14, color: "var(--ink2)" }}>{c.description}</p>}
      <div className="kv">
        <div><small>Team</small><b>{c.teamSize ? `${c.teamSize} people` : "Not listed"}</b></div>
        <div><small>Location</small><b>{c.location}</b></div>
      </div>
      {c.founders.length > 0 && <p className="fine">Founders: {c.founders.join(", ")}</p>}
      <p className="fine">As listed on the company's YC profile. Funding is not part of that profile.</p>
      <div className="row">
        <button className="btn" onClick={onPin}>+ Add to notes</button>
        <a href={ycProfileUrl(c.slug)} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13 }}>YC profile ↗</a>
        {c.website && (
          <a href={c.website} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13 }}>Website ↗</a>
        )}
      </div>
      {neighbours.length > 0 && (
        <div>
          <div className="mono">Same group</div>
          {neighbours.map((n) => (
            <button key={n.slug} className="item" onClick={() => onCompany(n.slug)}>
              <b>{n.name}</b>
              <small>{n.oneLiner}</small>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

type AnswerProps = {
  atlas: Atlas;
  answer: AnswerState;
  webHint: string;
  webAvailable: boolean;
  onCompany: (slug: string) => void;
  onRunWeb: () => void;
  onPin: () => void;
  onResume: () => void;
};

export function AnswerView({ atlas, answer, webHint, webAvailable, onCompany, onRunWeb, onPin, onResume }: AnswerProps) {
  return (
    <div className="view">
      <div className="asked">{answer.question}</div>
      {answer.status === "confirm" && (
        <>
          <p className="summary">This needs a web search beyond official sources.</p>
          <p className="fine">{webHint}</p>
          <div className="row">
            <button className="btn primary" onClick={onRunWeb}>Run web search</button>
            <button className="btn" onClick={onResume}>Cancel</button>
          </div>
        </>
      )}
      {(answer.status === "running" || (answer.status !== "confirm" && answer.steps.length > 0)) && (
        <div className="box steps">
          {answer.steps.length === 0 && <div className="step run"><i />Starting…</div>}
          {answer.steps.map((s, i) => (
            <div key={i} className={`step ${answer.status === "running" && i === answer.steps.length - 1 ? "run" : ""}`}>
              <i />
              {s}
            </div>
          ))}
        </div>
      )}
      {answer.status === "error" && <p className="summary err">{answer.error}</p>}
      {answer.card && <CardView atlas={atlas} card={answer.card} onCompany={onCompany} />}
      {answer.card?.needsWeb && (
        <div className="box">
          <p className="fine" style={{ marginBottom: 8 }}>{answer.card.needsWeb}</p>
          {webAvailable ? (
            <button className="btn primary" onClick={onRunWeb}>Search the web</button>
          ) : (
            <button className="btn primary" onClick={onPin}>Add to notes for an agent</button>
          )}
        </div>
      )}
      {answer.status !== "confirm" && (
        <div className="row">
          {answer.card && <button className="btn" onClick={onPin}>+ Add to notes</button>}
          <button className="btn" onClick={onResume}>Resume tour</button>
        </div>
      )}
    </div>
  );
}

type NotesProps = {
  notes: Note[];
  onHandoff: (id: string) => void;
  onRemove: (id: string) => void;
  onExport: () => void;
};

export function Notes({ notes, onHandoff, onRemove, onExport }: NotesProps) {
  if (!notes.length) return null;
  return (
    <section className="notes" aria-label="Notes">
      <div className="notes-head">
        <b>Notes</b>
        <span className="row">
          <span className="mono num">{notes.length}</span>
          <button className="link" onClick={onExport}>Export</button>
        </span>
      </div>
      {[...notes].reverse().map((n) => (
        <div className="note" key={n.id}>
          <span style={{ fontSize: 14, lineHeight: 1.45 }}>{n.text}</span>
          <div className="note-foot">
            <span className="mono plain">{n.meta}</span>
            <span className="row">
              {n.status === "open" && <button className="link" onClick={() => onHandoff(n.id)}>Hand off to agent</button>}
              {n.status === "sent" && <span className="mono status">Sent to agent</span>}
              {n.status === "copied" && <span className="mono status">Brief copied</span>}
              <button className="link" onClick={() => onRemove(n.id)} aria-label="Remove note">Remove</button>
            </span>
          </div>
        </div>
      ))}
    </section>
  );
}
