import { forwardRef } from "react";

type Props = {
  canPrev: boolean;
  nextLabel: string | null;
  value: string;
  placeholder: string;
  chips: string[];
  listening: boolean;
  showMic: boolean;
  onPrev: () => void;
  onNext: () => void;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onChip: (text: string) => void;
  onMic: () => void;
};

/** Always on screen: page through the briefing, or ask. */
export const Dock = forwardRef<HTMLInputElement, Props>(function Dock(
  { canPrev, nextLabel, value, placeholder, chips, listening, showMic, onPrev, onNext, onChange, onSubmit, onChip, onMic },
  ref,
) {
  return (
    <footer className="dock">
      <div className="pager">
        <button className="round" onClick={onPrev} disabled={!canPrev} aria-label="Previous page (←)" title="Previous (←)">
          <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3 5 8l5 5" fill="none" stroke="currentColor" strokeWidth="1.8" /></svg>
        </button>
        <button className="round next" onClick={onNext} disabled={!nextLabel} aria-label={nextLabel ? `Next: ${nextLabel} (→)` : "End of briefing"} title="Next (→)">
          <span>{nextLabel ? `Next: ${nextLabel}` : "End"}</span>
          <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="m6 3 5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.8" /></svg>
        </button>
      </div>
      <form
        className="ask"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        {showMic && (
          <button type="button" className={`round mic ${listening ? "on" : ""}`} onClick={onMic} aria-label={listening ? "Stop listening" : "Speak a question or command"}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <rect x="9" y="3" width="6" height="11" rx="3" />
              <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
            </svg>
          </button>
        )}
        <label htmlFor="ask" className="sr-only">Ask a question</label>
        <input ref={ref} id="ask" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} autoComplete="off" />
      </form>
      <div className="chips">
        {chips.map((c) => (
          <button key={c} type="button" className="chip" onClick={() => onChip(c)}>
            {c}
          </button>
        ))}
      </div>
    </footer>
  );
});
