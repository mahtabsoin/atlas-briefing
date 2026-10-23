// The one thing on screen. Each scene is readable at a glance and fits the stage.
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { Card } from "../../shared/card";
import { groupMedian, inGroup, placeCounts, spread } from "../../shared/dataset";
import { factOf, formatFact, type Atlas, type Item } from "../../shared/types";
import { AtlasMap } from "./AtlasMap";
import { CardView } from "./CardView";

export type AnswerState = { question: string; card: Card };

type Nav = { onItem: (id: string) => void; onAdd: () => void; added: boolean; aside: ReactNode };

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

function Head({ title, label, onAdd, added }: { title: string; label?: string; onAdd: () => void; added: boolean }) {
  return (
    <div className="head">
      <div>
        {label && <span className="label">{label}</span>}
        <h1>{title}</h1>
      </div>
      <button className={`btn ${added ? "on" : ""}`} onClick={onAdd} disabled={added} title="Add this to what you hand to Claude (A)">
        {added ? "✓ Added" : "+ Add"}
      </button>
    </div>
  );
}

const shortValue = (v: string) => v.split(" ")[0];

export function OverviewScene({ atlas, full, onGroup, onItem, onAdd, added, aside }: { atlas: Atlas; full: Atlas; onGroup: (g: number) => void } & Nav) {
  const grouped = atlas.items.filter((it) => it.group >= 0).length;
  const lead = atlas === full ? atlas.overview : `${atlas.items.length} of the ${full.items.length} ${atlas.noun[1]}. ${grouped} fall into the groups; ${atlas.items.length - grouped} are ungrouped.`;
  return (
    <div className="scene-body fill overview" key="overview">
      <div className="overview-side">
        <Head title={atlas === full ? atlas.title : scopeOf(atlas, full)} label={atlas === full ? undefined : atlas.title} onAdd={onAdd} added={added} />
        <p className="lead">{lead}</p>
        {aside}
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

/** Which filter value an atlas is scoped to, read back from its first item. */
const scopeOf = (atlas: Atlas, full: Atlas) => (atlas.filter && atlas !== full ? String(atlas.items[0]?.facts[atlas.filter.key] ?? "") : "");

export function GroupScene({ atlas, full, group, onItem, onAdd, added, aside }: { atlas: Atlas; full: Atlas; group: number } & Nav) {
  const g = atlas.groups[group];
  const members = inGroup(atlas, group);
  const num = factOf(atlas, "number");
  const place = factOf(atlas, "place");
  const top = place ? placeCounts(atlas, group, place.key)[0] : null;
  const split = spread(full, group);
  const scope = scopeOf(atlas, full);
  const max = Math.max(1, ...split.map((s) => s.count));
  return (
    <div className="scene-body fill split" key={g.id}>
      <div className="intro">
        <Head title={g.name} label={`Group ${group + 1} of ${atlas.groups.length}${scope ? ` · ${scope}: ${g.count}` : ""}`} onAdd={onAdd} added={added} />
        <p className="lead">{full.groups[group].narration}</p>
        <div className="figures">
        {split.length > 0 && (
          <div className="spread" aria-label={`By ${full.filter!.label.toLowerCase()}`}>
            {split.map((s) => (
              <div key={s.value} className={scope && scope !== s.value ? "off" : ""} title={`${s.value}: ${s.count}`}>
                <span className="bar"><i style={{ height: `${Math.round((s.count / max) * 100)}%` }} /></span>
                <b className="num">{s.count}</b>
                <small>{shortValue(s.value)}</small>
              </div>
            ))}
          </div>
        )}
        {(num || (top && top[0] !== "Not listed")) && (
          <div className="stats">
            {num && <div className="stat"><b>{groupMedian(atlas, group, num.key)}</b><span>median {num.label.toLowerCase()}</span></div>}
            {top && top[0] !== "Not listed" && <div className="stat"><b>{top[1]}</b><span>in {top[0]}</span></div>}
          </div>
        )}
        </div>
        {aside}
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

export function ItemScene({ atlas, id, onItem, onAdd, added, aside }: { atlas: Atlas; id: string } & Nav) {
  const it = atlas.items.find((x) => x.id === id)!;
  const neighbours = it.group < 0 ? [] : inGroup(atlas, it.group).filter((x) => x.id !== id);
  const facts = atlas.facts.filter((f) => it.facts[f.key] !== undefined);
  return (
    <div className="scene-body fill split" key={id}>
      <div className="intro">
        <Head title={it.name} label={it.group < 0 ? "Ungrouped" : atlas.groups[it.group].name} onAdd={onAdd} added={added} />
        <p className="summary">
          <Evidence it={it} />
        </p>
        {it.description && <p className="desc">{it.description}</p>}
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
        {aside}
      </div>
      {neighbours.length > 0 ? (
        <div className="tiles-col">
          <div className="label">Same group</div>
          <FitTiles
            count={neighbours.length}
            render={(i) => (
              <button key={neighbours[i].id} className="tile" onClick={() => onItem(neighbours[i].id)}>
                <b>{neighbours[i].name}</b>
                <small>{neighbours[i].summary}</small>
              </button>
            )}
          />
        </div>
      ) : (
        <div />
      )}
    </div>
  );
}

export function AnswerScene({ atlas, answer, onItem, onAdd, added, aside }: { atlas: Atlas; answer: AnswerState } & Nav) {
  return (
    <div className="scene-body fill split answer" key={answer.question}>
      <div className="intro">
        <Head title={answer.question} label="Quick fact · from the atlas" onAdd={onAdd} added={added} />
        <p className="summary">{answer.card.summary}</p>
        {aside}
      </div>
      <div className="answer-body">
        <CardView atlas={atlas} card={answer.card} onItem={onItem} hideSummary />
      </div>
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
