import type { AskEvent } from "../../shared/card";
import type { Context } from "./router";

export type Health = { answers: boolean; search: "exa" | "anthropic" | null; handoff: boolean };

export const OFFLINE: Health = { answers: false, search: null, handoff: false };

export async function getHealth(): Promise<Health> {
  try {
    const res = await fetch("/api/health");
    return res.ok ? ((await res.json()) as Health) : OFFLINE;
  } catch {
    return OFFLINE;
  }
}

/** Streams answer events; yields one error event on any transport failure. */
export async function* ask(question: string, tier: "official" | "web", context: Context, signal: AbortSignal): AsyncGenerator<AskEvent> {
  let res: Response;
  try {
    res = await fetch("/api/ask", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question, tier, context }),
      signal,
    });
  } catch {
    if (!signal.aborted) yield { type: "error", message: "Could not reach the server." };
    return;
  }
  if (!res.ok || !res.body) {
    const body = await res.json().catch(() => null);
    yield { type: "error", message: body?.error ?? `The server returned HTTP ${res.status}.` };
    return;
  }
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += value;
      let nl: number;
      while ((nl = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (line) yield JSON.parse(line) as AskEvent;
      }
    }
  } catch {
    if (!signal.aborted) yield { type: "error", message: "The connection dropped before the answer finished." };
  }
}

export async function handoff(task: string, context: unknown, sources: string[]): Promise<"sent" | "unavailable" | "failed"> {
  try {
    const res = await fetch("/api/handoff", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ task, context, sources }),
    });
    if (res.status === 501) return "unavailable";
    return res.ok ? "sent" : "failed";
  } catch {
    return "unavailable";
  }
}
