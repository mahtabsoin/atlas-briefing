// Typed access to the Claude artifact runtime. Every capability may be absent
// (opened as a plain file, or in a view that doesn't grant it); callers design for null.
import type { Atlas } from "../../shared/types";

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };
export type CanSend = "available" | "available_if_summoned" | "available_if_opened" | "no_session" | "unsupported" | "off";
export type Room = {
  presence(patch: Record<string, Json | null>): Promise<void>;
  canSendToClaudeSession(): Promise<CanSend>;
  sendToClaudeSession(data: { label?: string } & { [k: string]: Json }, options?: { deliver?: "stage" | "send" }): Promise<{ to: string }>;
};

type ClaudeRuntime = { use(name: string): Promise<unknown> };
const runtime = (): ClaudeRuntime | null => (window as unknown as { claude?: ClaudeRuntime }).claude ?? null;

/** True inside a Claude artifact. */
export const IN_CLAUDE = typeof window !== "undefined" && !!runtime();

export async function getRoom(): Promise<Room | null> {
  try {
    return ((await runtime()?.use("room")) as Room | null) ?? null;
  } catch {
    return null;
  }
}

/** The atlas is inlined into the page by the builder (or by the dev server). */
export function loadAtlas(): Atlas {
  const el = document.getElementById("atlas-data");
  return JSON.parse(el?.textContent ?? "null") as Atlas;
}

export type { Json };
