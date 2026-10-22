import { useEffect, useRef, useState } from "react";

type Props = {
  /** What the note is about, shown read-only. */
  subject: string;
  /** Starting text for the ask, e.g. the question that needs the web. */
  initial: string;
  busy: boolean;
  onAdd: (ask: string) => void;
  onCancel: () => void;
};

/** A note is one question for Claude to research later. It lands as a comment on the atlas. */
export function NoteSheet({ subject, initial, busy, onAdd, onCancel }: Props) {
  const [ask, setAsk] = useState(initial);
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => ref.current?.focus(), []);
  return (
    <form
      className="sheet"
      onSubmit={(e) => {
        e.preventDefault();
        onAdd(ask.trim());
      }}
      onKeyDown={(e) => e.key === "Escape" && onCancel()}
    >
      <div className="label">Note for Claude</div>
      <div className="sheet-subject">{subject}</div>
      <label htmlFor="note-ask" className="sr-only">What should Claude find out?</label>
      <textarea
        id="note-ask"
        ref={ref}
        className="comment"
        rows={2}
        maxLength={1500}
        value={ask}
        placeholder="What should Claude find out? Leave blank for background and recent news."
        onChange={(e) => setAsk(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            onAdd(ask.trim());
          }
        }}
      />
      <div className="row" style={{ justifyContent: "flex-end" }}>
        <button type="button" className="btn ghost" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn primary" disabled={busy}>{busy ? "Adding…" : "Add note"}</button>
      </div>
    </form>
  );
}
