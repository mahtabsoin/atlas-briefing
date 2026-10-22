type Props = {
  labels: string[];
  chapter: number;
  within: number;
  playing: boolean;
  narrating: boolean;
  status: string;
  clock: string;
  spoken: string;
  rest: string;
  onToggle: () => void;
  onJump: (chapter: number) => void;
};

export function Transport({ labels, chapter, within, playing, narrating, status, clock, spoken, rest, onToggle, onJump }: Props) {
  return (
    <>
      <div className="segs">
        {labels.map((label, i) => (
          <button key={label} className={`seg ${i === chapter ? "cur" : ""}`} aria-label={`Jump to ${label}`} title={label} onClick={() => onJump(i)}>
            <i>
              <b style={{ width: `${i < chapter ? 100 : i === chapter ? Math.round(within * 100) : 0}%` }} />
            </i>
          </button>
        ))}
      </div>
      <div className="transport">
        <button className="round play" onClick={onToggle} aria-label={playing ? "Pause the tour" : "Play the tour"}>
          {playing ? (
            <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
              <rect x="3" y="2" width="3.5" height="12" fill="currentColor" />
              <rect x="9.5" y="2" width="3.5" height="12" fill="currentColor" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
              <path d="M4 2.5v11l9.5-5.5z" fill="currentColor" />
            </svg>
          )}
        </button>
        <div className="caption-wrap">
          <div className="mono caption-meta">
            <span className={`eq ${narrating ? "" : "off"}`} aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
            </span>
            <span>{status}</span>
            <span className="num" style={{ marginLeft: "auto" }}>
              {clock}
            </span>
          </div>
          <p className="caption" aria-live="polite">
            <span>{spoken}</span> <span className="rest">{rest}</span>
          </p>
        </div>
      </div>
    </>
  );
}
