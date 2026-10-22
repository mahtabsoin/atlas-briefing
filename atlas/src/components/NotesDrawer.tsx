import type { Atlas } from "../../shared/types";
import type { Note } from "../lib/notes";
import { CardView } from "./CardView";

type Props = {
  atlas: Atlas;
  notes: Note[];
  canResearch: boolean;
  storedIn: "artifact" | "browser";
  onClose: () => void;
  onResearch: (note: Note) => void;
  onResearchAll: () => void;
  onRemove: (id: string) => void;
  onExport: () => void;
  onCompany: (slug: string) => void;
};

const STATUS: Record<Note["status"], string> = {
  open: "",
  researching: "Researching…",
  done: "Finding ready",
  failed: "Couldn't start",
  copied: "Brief copied",
  sent: "Sent to agent",
};

export function NotesDrawer({ atlas, notes, canResearch, storedIn, onClose, onResearch, onResearchAll, onRemove, onExport, onCompany }: Props) {
  const open = notes.filter((n) => n.status === "open" || n.status === "failed");
  return (
    <section className="drawer" aria-label="Notes">
      <div className="drawer-head">
        <div>
          <b>Notes</b>
          <div className="fine">{storedIn === "artifact" ? "Saved with this atlas" : "Saved in this browser"}</div>
        </div>
        <div className="row">
          {open.length > 1 && (
            <button className="btn primary" onClick={onResearchAll}>
              {canResearch ? `Research ${open.length}` : `Send ${open.length}`}
            </button>
          )}
          {notes.length > 0 && <button className="btn ghost" onClick={onExport}>Export</button>}
          <button className="btn ghost" onClick={onClose} aria-label="Close notes">✕</button>
        </div>
      </div>
      <div className="drawer-body">
        {notes.length === 0 && (
          <p className="fine" style={{ padding: "16px 0" }}>
            Nothing yet. Press <b>+ Note</b> on any page or answer, or ask something the snapshot can't answer. Notes you send are researched by Claude in the background, and the findings show up here.
          </p>
        )}
        {[...notes].reverse().map((n) => (
          <div className="note" key={n.id}>
            <span className="note-text">{n.text}</span>
            <div className="note-foot">
              <span className="label" style={{ textTransform: "none", letterSpacing: 0 }}>{n.meta}</span>
              <span className="row">
                {STATUS[n.status] && <span className="status">{STATUS[n.status]}</span>}
                {n.sessionUrl && n.status === "researching" && (
                  <a className="link" href={n.sessionUrl} target="_blank" rel="noopener noreferrer">Watch</a>
                )}
                {(n.status === "open" || n.status === "failed") && (
                  <button className="link" onClick={() => onResearch(n)}>{canResearch ? "Research" : "Copy brief"}</button>
                )}
                <button className="link" onClick={() => onRemove(n.id)}>Remove</button>
              </span>
            </div>
            {n.error && n.status === "failed" && <p className="fine">{n.error}</p>}
            {n.finding && (
              <div className="finding">
                <CardView atlas={atlas} card={n.finding} onCompany={onCompany} />
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
