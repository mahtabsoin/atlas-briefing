import type { Block, Card } from "../../shared/card";
import type { Atlas } from "../../shared/types";

type Props = { atlas: Atlas; card: Card; onCompany: (slug: string) => void };

/** Renders a Card from the fixed block kit. Nothing model-written is ever treated as HTML. */
export function CardView({ atlas, card, onCompany }: Props) {
  const lookup = (slug: string) => atlas.companies.find((c) => c.slug === slug);
  return (
    <>
      <p className="summary">{card.summary}</p>
      {card.blocks.map((b, i) => (
        <BlockView key={i} block={b} card={card} lookup={lookup} onCompany={onCompany} />
      ))}
      {card.notStated.length > 0 && (
        <div className="box">
          <div className="label">Not stated in the sources checked</div>
          <div style={{ fontSize: 13.5, marginTop: 4 }}>{card.notStated.join(" · ")}</div>
        </div>
      )}
      {card.sources.length > 0 && (
        <div className="sources">
          <div className="label">Sources</div>
          {card.sources.map((s, i) => (
            <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer">
              [{i + 1}] {s.title}
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
  if (block.type === "text") return <p className="fine" style={{ fontSize: 14 }}>{block.text}</p>;
  if (block.type === "bars") {
    const max = Math.max(...block.items.map((x) => x.value), 1);
    return (
      <div className="box bars">
        <div className="label">{block.title}</div>
        {block.items.map((x) => (
          <div className="bar" key={x.label}>
            {x.slug ? (
              <button onClick={() => onCompany(x.slug!)} title={`Open ${x.label}`}>{x.label}</button>
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
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {block.title && <div className="label">{block.title}</div>}
        <div className="tiles">
          {block.items.map((x) => {
            const c = lookup(x.slug);
            return c ? (
              <button key={x.slug} className="tile" onClick={() => onCompany(x.slug)}>
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
