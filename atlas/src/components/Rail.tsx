import type { Atlas } from "../../shared/types";
import { AtlasMap } from "./AtlasMap";

type Props = {
  atlas: Atlas;
  open: boolean;
  page: number | null;
  seen: Set<number>;
  focus: number | null;
  selected: string | null;
  highlight: Set<string> | null;
  onPage: (p: number) => void;
  onCompany: (slug: string) => void;
  onGroup: (group: number) => void;
};

/** Where you are (map) and what's left (pages), side by side with the scene. */
export function Rail({ atlas, open, page, seen, focus, selected, highlight, onPage, onCompany, onGroup }: Props) {
  const pages = ["Overview", ...atlas.groups.map((g) => g.name)];
  const counts = [atlas.companies.length, ...atlas.groups.map((g) => g.count)];
  return (
    <aside className={`rail ${open ? "open" : ""}`} aria-label="Map and pages">
      {(page !== 0 || open) && <AtlasMap atlas={atlas} focus={focus} selected={selected} highlight={highlight} onCompany={onCompany} onGroup={onGroup} />}
      <nav className="chapters" aria-label="Pages">
        {pages.map((name, i) => (
          <button key={name} className={`chapter ${page === i ? "on" : ""} ${seen.has(i) ? "seen" : ""}`} onClick={() => onPage(i)} aria-current={page === i ? "page" : undefined}>
            <span className="k num">{seen.has(i) && page !== i ? "✓" : String(i).padStart(2, "0")}</span>
            <span>{name}</span>
            <span className="c num">{counts[i]}</span>
          </button>
        ))}
      </nav>
    </aside>
  );
}
