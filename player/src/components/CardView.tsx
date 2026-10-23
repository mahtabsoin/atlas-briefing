import type { Block, Card } from "../../shared/card";
import type { Atlas } from "../../shared/types";

type Props = { atlas: Atlas; card: Card; onItem: (id: string) => void; hideSummary?: boolean };

/** Renders a Card from the fixed block kit. Nothing model-written is ever treated as HTML. */
export function CardView({ atlas, card, onItem, hideSummary }: Props) {
  const lookup = (id: string) => atlas.items.find((it) => it.id === id);
  return (
    <>
      {!hideSummary && <p className="summary">{card.summary}</p>}
      {card.blocks.map((b, i) => (
        <BlockView key={i} block={b} card={card} lookup={lookup} onItem={onItem} />
      ))}
      {card.notStated.length > 0 && (
        <div className="box">
          <div className="label">Not stated in the atlas</div>
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
  onItem,
}: {
  block: Block;
  card: Card;
  lookup: (id: string) => { name: string; summary: string } | undefined;
  onItem: (id: string) => void;
}) {
  if (block.type === "text") return <p className="fine" style={{ fontSize: 14 }}>{block.text}</p>;
  if (block.type === "bars") {
    const max = Math.max(...block.items.map((x) => x.value), 1);
    return (
      <div className="box bars">
        <div className="label">{block.title}</div>
        {block.items.map((x) => (
          <div className="bar" key={x.label}>
            {x.id ? (
              <button onClick={() => onItem(x.id!)} title={`Open ${x.label}`}>{x.label}</button>
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
  if (block.type === "items") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {block.title && <div className="label">{block.title}</div>}
        <div className="tiles">
          {block.items.map((x) => {
            const it = lookup(x.id);
            return it ? (
              <button key={x.id} className="tile" onClick={() => onItem(x.id)}>
                <b>{it.name}</b>
                <small>{x.note ?? it.summary}</small>
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
