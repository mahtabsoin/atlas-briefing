import type { Pick } from "../lib/tray";

type Props = {
  picks: Pick[];
  questions: string[];
  quick: string[];
  /** How a hand-off reaches Claude from this view: the chat beside the page, or copied text. */
  route: "chat" | "copy";
  onRemove: (key: string) => void;
  onSend: () => void;
  onAsk: (question: string) => void;
  onQuick: (label: string) => void;
};

/** Where an atlas hands over to the viewer's Claude chat: picks stack here and go as one attachment. */
export function Continue({ picks, questions, quick, route, onRemove, onSend, onAsk, onQuick }: Props) {
  return (
    <section className="continue" aria-label="Continue in Claude">
      <div className="continue-head">
        <span className="label">Continue in Claude</span>
        {picks.length > 0 && (
          <button className="btn primary small" onClick={onSend}>
            {route === "chat" ? `Send ${picks.length} to chat` : `Copy ${picks.length} for Claude`}
          </button>
        )}
      </div>
      {picks.length > 0 ? (
        <ul className="picks">
          {picks.map((p) => (
            <li key={p.key}>
              <span>{p.name}</span>
              <button className="x" onClick={() => onRemove(p.key)} aria-label={`Remove ${p.name}`}>×</button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="fine">Use "+ Add" to collect things here, then hand them all to your chat at once.</p>
      )}
      <div className="asks">
        {questions.map((q) => (
          <button key={q} className="ask-q" onClick={() => onAsk(q)}>
            <span>{q}</span>
            <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h9M8 3l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.8" /></svg>
          </button>
        ))}
      </div>
      {quick.length > 0 && (
        <div className="quick">
          <span className="label">Quick facts</span>
          {quick.map((q) => (
            <button key={q} className="link" onClick={() => onQuick(q)}>{q}</button>
          ))}
        </div>
      )}
    </section>
  );
}
