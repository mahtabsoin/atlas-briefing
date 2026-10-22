import { forwardRef } from "react";

type Props = {
  canPrev: boolean;
  nextLabel: string | null;
  value: string;
  placeholder: string;
  chips: string[];
  onPrev: () => void;
  onNext: () => void;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onChip: (text: string) => void;
};

/** Always on screen: page through the briefing, or ask. */
export const Dock = forwardRef<HTMLInputElement, Props>(function Dock(
  { canPrev, nextLabel, value, placeholder, chips, onPrev, onNext, onChange, onSubmit, onChip },
  ref,
) {
  return (
    <footer className="dock">
      <div className="pager">
        <button className="round" onClick={onPrev} disabled={!canPrev} aria-label="Previous page (←)" title="Previous (←)">
          <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3 5 8l5 5" fill="none" stroke="currentColor" strokeWidth="1.8" /></svg>
        </button>
        <button className="round next" onClick={onNext} disabled={!nextLabel} aria-label={nextLabel ? `Next: ${nextLabel} (→)` : "End"} title="Next (→)">
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
