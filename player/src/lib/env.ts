// Typed access to the Claude artifact runtime. Every capability may be absent
// (opened as a plain file, or in a view that doesn't grant it); callers design for null.
import type { Atlas } from "../../shared/types";

export type Sample = ((input: string, options?: Record<string, unknown>) => Promise<{ text: string }>) & {
  json: <T = unknown>(input: string, options?: Record<string, unknown>) => Promise<T>;
};
export type Anchor = { path: string; x: number; y: number };
export type CanSend = "available" | "writers_only" | "no_session" | "off";
export type Comments = {
  openComposer(target: { element: Element }): Promise<{ opened: boolean }>;
  anchorFor(el: Element): Promise<Anchor>;
  create(opts: { anchor: Anchor; text: string }): Promise<{ threadId: string }>;
  sendToClaude(target: { anchor: Anchor; text: string }): Promise<{ threadId: string }>;
  canSendToClaude(): Promise<CanSend>;
};

type ClaudeRuntime = { use(name: string): Promise<unknown> };
const runtime = (): ClaudeRuntime | null => (window as unknown as { claude?: ClaudeRuntime }).claude ?? null;

/** True inside a Claude artifact. */
export const IN_CLAUDE = typeof window !== "undefined" && !!runtime();

async function use<T>(name: string): Promise<T | null> {
  try {
    return ((await runtime()?.use(name)) as T | null) ?? null;
  } catch {
    return null;
  }
}

export const getSample = () => use<Sample>("sample");
export const getComments = () => use<Comments>("comments");

/** The atlas is inlined into the page by the builder (or by the dev server). */
export function loadAtlas(): Atlas {
  const el = document.getElementById("atlas-data");
  return JSON.parse(el?.textContent ?? "null") as Atlas;
}
