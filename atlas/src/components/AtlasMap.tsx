import { memo } from "react";
import type { Atlas } from "../../shared/types";

type Props = {
  atlas: Atlas;
  /** Group the camera zooms to, or null for the whole batch. */
  focus: number | null;
  selected: string | null;
  /** When set, only these companies are lit. */
  highlight: Set<string> | null;
  tag: string;
  onCompany: (slug: string) => void;
  onGroup: (group: number) => void;
};

const ZOOM = 1.7;

function camera(atlas: Atlas, focus: number | null): string {
  if (focus === null) return "none";
  const lo = 50 / ZOOM;
  const hi = 100 - lo;
  const [gx, gy] = atlas.groups[focus].center;
  const cx = Math.max(lo, Math.min(hi, gx));
  const cy = Math.max(lo, Math.min(hi, gy));
  return `scale(${ZOOM}) translate(${(50 - cx).toFixed(1)}%, ${(50 - cy).toFixed(1)}%)`;
}

export const AtlasMap = memo(function AtlasMap({ atlas, focus, selected, highlight, tag, onCompany, onGroup }: Props) {
  return (
    <div className="map">
      <div className="cam" style={{ transform: camera(atlas, highlight ? null : focus) }}>
        {atlas.groups.map((g, i) => (
          <button
            key={g.id}
            className={`tlabel ${highlight ? "off" : focus === null ? "" : focus === i ? "on" : "off"}`}
            style={{ left: `${g.center[0]}%`, top: `${Math.max(5, g.center[1] - 14)}%` }}
            onClick={() => onGroup(i)}
          >
            {g.short}
            <span>{g.count}</span>
          </button>
        ))}
        {atlas.companies.map((c) => {
          let cls: string;
          if (c.slug === selected) cls = "sel";
          else if (highlight) cls = highlight.has(c.slug) ? "hi" : "dim";
          else if (focus === null) cls = c.group < 0 ? "faint" : "mid";
          else cls = c.group === focus ? "hi" : "dim";
          return (
            <button
              key={c.slug}
              className={`dot ${cls}`}
              style={{ left: `${c.x}%`, top: `${c.y}%` }}
              aria-label={c.name}
              title={c.name}
              onClick={() => onCompany(c.slug)}
            />
          );
        })}
      </div>
      <div className="mono map-tag">{tag}</div>
      <div className="mono plain map-hint">1 dot = 1 company · click, or say a name</div>
    </div>
  );
});
