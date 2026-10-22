// Notes are artifact comments: each one a thread Claude answers in place.
// These build the plain text that goes into them.
export type Note = { subject: string; ask: string; urls: string[]; threadId?: string };

export const DEFAULT_ASK = "Background and recent news, from official sources first.";
export const PICKUP = "research my atlas comments";

export const noteText = (n: Note) =>
  [`Research: ${n.ask || DEFAULT_ASK}`, `About: ${n.subject}`, ...(n.urls.length ? [`Start from: ${n.urls.join(" ")}`] : [])].join("\n");

/** The one message that hands every note to Claude at once. Comments cap at 4 KiB. */
export function sendText(notes: Note[], title: string): string {
  const lines = notes.map((n, i) => `${i + 1}. ${n.ask || DEFAULT_ASK} (${n.subject})`);
  let text = `Research the open notes on this atlas (${title}) and reply in each thread. New this visit:\n${lines.join("\n")}`;
  while (new TextEncoder().encode(text).length > 3900 && lines.length > 1) {
    lines.pop();
    text = `Research the open notes on this atlas (${title}) and reply in each thread. New this visit (first ${lines.length} of ${notes.length}):\n${lines.join("\n")}`;
  }
  return text;
}

/** Outside Claude there are no comments; the notes travel as one block of text. */
export const brief = (notes: Note[], title: string) =>
  `Research these notes from my atlas "${title}". Official sources first, cite every fact, say what isn't stated.\n\n${notes.map((n, i) => `${i + 1}. ${noteText(n)}`).join("\n\n")}`;
