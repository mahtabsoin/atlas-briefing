import { forwardRef } from "react";
import { TIER_INFO } from "../../shared/tiers";

type Props = {
  value: string;
  placeholder: string;
  chips: string[];
  activeTier: keyof typeof TIER_INFO | null;
  listening: boolean;
  canListen: boolean;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onChip: (text: string) => void;
  onMic: () => void;
};

const TIER_ORDER = ["tour", "dataset", "official", "web", "agent"] as const;

export const AskBar = forwardRef<HTMLInputElement, Props>(function AskBar(
  { value, placeholder, chips, activeTier, listening, canListen, onChange, onSubmit, onChip, onMic },
  ref,
) {
  return (
    <form
      className="ask"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <div className="ask-row">
        <button
          type="button"
          className={`round mic ${listening ? "on" : ""}`}
          onClick={onMic}
          disabled={!canListen}
          aria-label={canListen ? (listening ? "Stop listening" : "Speak a question or command") : "Voice input isn't supported in this browser"}
          title={canListen ? "Speak: a question, a company or group name, or a command like “next”, “pause”, “add to notes”" : "Voice input isn't supported in this browser"}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
            <rect x="9" y="3" width="6" height="11" rx="3" />
            <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
          </svg>
        </button>
        <label htmlFor="ask" className="sr-only">
          Ask a question
        </label>
        <input ref={ref} id="ask" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} autoComplete="off" />
      </div>
      <div className="chips">
        {chips.map((c) => (
          <button key={c} type="button" className="chip" onClick={() => onChip(c)}>
            {c}
          </button>
        ))}
      </div>
      <div className="tiers">
        <span className="mono plain" style={{ marginRight: 6 }}>
          Answer depth
        </span>
        {TIER_ORDER.map((t) => (
          <span key={t} className={`tier ${t === activeTier ? "on" : ""}`} title={TIER_INFO[t].hint}>
            {TIER_INFO[t].name}
          </span>
        ))}
      </div>
    </form>
  );
});
