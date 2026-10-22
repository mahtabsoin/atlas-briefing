import { useState } from "react";
import type { Atlas } from "../../shared/types";
import type { Note } from "../lib/notes";
import { PICKUP_PHRASE } from "../lib/research";
import { CardView } from "./CardView";

type Props = {
  atlas: Atlas;
  notes: Note[];
  /** True when notes live in the atlas, where Claude can collect them. */
  queue: boolean;
  onClose: () => void;
  onComment: (note: Note, comment: string) => void;
  onSend: () => void;
  onCopy: (notes: Note[]) => void;
  onRemove: (id: string) => void;
  onExport: () => void;
  onCompany: (slug: string) => void;
};

/** Review notes, add your own instructions, then send them to Claude in one go. */
export function NotesDrawer({ atlas, notes, queue, onClose, onComment, onSend, onCopy, onRemove, onExport, onCompany }: Props) {
  const drafts = notes.filter((n) => n.status === "open" || n.status === "failed");
  const waiting = notes.filter((n) => n.status === "queued" || n.status === "researching" || n.status === "sent" || n.status === "copied");
  const done = notes.filter((n) => n.status === "done" && n.finding);
  return (
    <section className="drawer" aria-label="Notes">
      <div className="drawer-head">
        <div>
          <b>Notes</b>
          <div className="fine">{queue ? "Saved with this atlas" : "Saved in this browser"}</div>
        </div>
        <div className="row">
          {notes.length > 0 && <button className="btn ghost" onClick={onExport}>Export</button>}
          <button className="btn ghost icon" onClick={onClose} aria-label="Close notes">
            <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3l10 10M13 3 3 13" stroke="currentColor" strokeWidth="1.6" /></svg>
          </button>
        </div>
      </div>

      <div className="drawer-body">
        {notes.length === 0 && (
          <p className="fine" style={{ padding: "16px 0" }}>
            Nothing yet. Press <b>+ Note</b> on any page or answer, or ask something that needs the web. Review your notes here, add your own instructions, then send them to Claude together.
          </p>
        )}

        {drafts.length > 0 && <div className="label section">To review · {drafts.length}</div>}
        {drafts.map((n) => (
          <Draft key={n.id} note={n} onComment={onComment} onRemove={onRemove} />
        ))}

        {waiting.length > 0 && <div className="label section">Sent · {waiting.length}</div>}
        {waiting.length > 0 && queue && waiting.some((n) => n.status === "queued") && (
          <div className="box" style={{ fontSize: 13.5, display: "flex", flexDirection: "column", gap: 6 }}>
            <span>
              In Claude Code, say <b>“{PICKUP_PHRASE}”</b>. Claude collects these, searches the web, and the findings appear here.
            </span>
            <button className="link" style={{ alignSelf: "flex-start" }} onClick={() => onCopy(waiting)}>Or copy them as a brief</button>
          </div>
        )}
        {waiting.map((n) => (
          <div className="note" key={n.id}>
            <span className="note-text">{n.text}</span>
            {n.comment && <span className="fine">Your note: {n.comment}</span>}
            <div className="note-foot">
              <span className="status">{n.status === "researching" ? "Claude is researching" : n.status === "copied" ? "Brief copied" : n.status === "sent" ? "Sent to agent" : "Waiting for Claude"}</span>
              <button className="link" onClick={() => onRemove(n.id)}>Remove</button>
            </div>
          </div>
        ))}

        {done.length > 0 && <div className="label section">Findings · {done.length}</div>}
        {done.map((n) => (
          <div className="note" key={n.id}>
            <span className="note-text">{n.text}</span>
            <div className="finding">
              <CardView atlas={atlas} card={n.finding!} onCompany={onCompany} />
            </div>
            <div className="note-foot">
              <span className="fine">Researched by Claude</span>
              <button className="link" onClick={() => onRemove(n.id)}>Remove</button>
            </div>
          </div>
        ))}
      </div>

      {drafts.length > 0 && (
        <div className="drawer-foot">
          <button className="btn primary" style={{ width: "100%", justifyContent: "center" }} onClick={onSend}>
            {queue ? `Send ${drafts.length} to Claude` : `Copy ${drafts.length} as a brief for Claude`}
          </button>
          {!queue && <p className="fine">This view can't hand notes to Claude directly. Paste the brief into any Claude chat to research them.</p>}
        </div>
      )}
    </section>
  );
}

function Draft({ note, onComment, onRemove }: { note: Note; onComment: (n: Note, c: string) => void; onRemove: (id: string) => void }) {
  const [comment, setComment] = useState(note.comment ?? "");
  return (
    <div className="note">
      <span className="note-text">{note.text}</span>
      <label className="sr-only" htmlFor={`c-${note.id}`}>Your instructions for this note</label>
      <textarea
        id={`c-${note.id}`}
        className="comment"
        rows={2}
        placeholder="Add what you want Claude to find out…"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        onBlur={() => comment !== (note.comment ?? "") && onComment(note, comment.trim())}
      />
      <div className="note-foot">
        <span className="label" style={{ textTransform: "none", letterSpacing: 0 }}>{note.meta}</span>
        <button className="link" onClick={() => onRemove(note.id)}>Remove</button>
      </div>
      {note.error && <p className="fine">{note.error}</p>}
    </div>
  );
}
