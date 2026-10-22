import type { Block, Card } from "../../shared/card";
import { TIER_INFO } from "../../shared/tiers";
import type { Atlas } from "../../shared/types";

type Props = { atlas: Atlas; card: Card; onCompany: (slug: string) => void };

/** Renders a Card from the fixed block kit. Nothing model-written is ever treated as HTML. */
export function CardView({ atlas, card, onCompany }: Props) {
  const name = (slug: string) => atlas.companies.find((c) => c.slug === slug);
  return (
    <>
      <span className="mono">Depth: {TIER_INFO[card.tier].name}</span>
      <p className="summary">{card.summary}</p>
      {card.blocks.map((b, i) => (
        <BlockView key={i} block={b} card={card} lookup={name} onCompany={onCompany} />
      ))}
      {card.notStated.length > 0 && (
        <div className="box">
          <div className="mono" style={{ marginBottom: 4 }}>
            Not stated in the sources checked
          </div>
          <div style={{ fontSize: 13 }}>{card.notStated.join(" · ")}</div>
        </div>
      )}
      {card.sources.length > 0 && (
        <div className="sources">
          <div className="mono">Sources</div>
          {card.sources.map((s, i) => (
            <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer">
              [{i + 1}] {s.title} <span className="mono plain">· {s.kind}</span>
            </a>
          ))}
        </div>
      )}
    </>
  );
}

function BlockView({
  block,
  card,
  lookup,
  onCompany,
}: {
  block: Block;
  card: Card;
  lookup: (slug: string) => { name: string; oneLiner: string } | undefined;
  onCompany: (slug: string) => void;
}) {
  if (block.type === "text") return <p className="fine" style={{ fontSize: 13 }}>{block.text}</p>;
  if (block.type === "bars") {
    const max = Math.max(...block.items.map((x) => x.value), 1);
    return (
      <div className="box bars">
        <div className="mono">{block.title}</div>
        {block.items.map((x) => (
          <div className="bar" key={x.label}>
            {x.slug ? (
              <button onClick={() => onCompany(x.slug!)} title={`Open ${x.label}`}>
                {x.label}
              </button>
            ) : (
              <span>{x.label}</span>
            )}
            <span className="track">
              <span className="fill" style={{ width: `${Math.round((x.value / max) * 100)}%` }} />
            </span>
            <span className="v">{x.value}</span>
          </div>
        ))}
      </div>
    );
  }
  if (block.type === "companies") {
    return (
      <div>
        {block.title && <div className="mono">{block.title}</div>}
        <div className="scroll">
          {block.items.map((x) => {
            const c = lookup(x.slug);
            return c ? (
              <button key={x.slug} className="item" onClick={() => onCompany(x.slug)}>
                <b>{c.name}</b>
                <small>{x.note ?? c.oneLiner}</small>
              </button>
            ) : null;
          })}
        </div>
      </div>
    );
  }
  return (
    <div className="facts">
      {block.items.map((f, i) => (
        <div className="fact" key={i}>
          <span>{f.label}</span>
          <span>
            {f.value}
            {f.source !== undefined && card.sources[f.source] && (
              <a href={card.sources[f.source].url} target="_blank" rel="noopener noreferrer" style={{ marginLeft: 6 }}>
                [{f.source + 1}]
              </a>
            )}
          </span>
        </div>
      ))}
    </div>
  );
}
