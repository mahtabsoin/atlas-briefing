// Sends a note to a background Claude session (through the viewer's Claude Code
// connector). That session can search the web and writes its finding back into
// this artifact's store, where the notes panel picks it up live.
import { ARTIFACT_URL, getMcp } from "./env";
import type { Note } from "./notes";

const SERVER = "Claude Code Remote";

export type ResearchResult = { ok: true; sessionUrl?: string } | { ok: false; reason: string };

const REASONS: Record<string, string> = {
  server_not_connected: "Connect Claude Code in claude.ai Settings → Connectors to research in the background.",
  needs_reauth: "Reconnect Claude Code in claude.ai Settings → Connectors.",
  not_in_manifest: "Background research isn't allowed for this page. Allow Claude Code when the page asks.",
  blocked_by_policy: "Your organization blocks starting Claude sessions from pages.",
  not_granted: "Background research isn't available in this view.",
  capability_disabled: "Background research isn't available in this view.",
};

export function researchPrompt(note: Note, owner: string, batch: string, context: string): string {
  return `Background research for a Batch Signal note (an interactive map of YC ${batch}).

Task: ${note.text}
${context ? `Context from the YC snapshot: ${context}\n` : ""}${note.sources.length ? `Starting points: ${note.sources.join(", ")}\n` : ""}
How to research:
- Search the web. Official sources first (YC profile, the company's site and press releases, SEC filings), then reputable press with a named author and date.
- Every fact needs a source URL you actually opened. If nothing answers part of the task, list it under notStated. Unknown is not zero.
- Report, don't judge: no opinions or adjectives like "promising". Keep the summary to 1-3 sentences.

When done, save the result so it appears in the viewer's notes. Use the ArtifactData tool on ${ARTIFACT_URL}: action "set", collection "findings", doc_id "${note.id}", data:
{"owner": "${owner}", "noteId": "${note.id}", "finishedAt": "<ISO time>",
 "card": {"summary": "...", "tier": "web",
   "blocks": [{"type": "facts", "items": [{"label": "...", "value": "...", "source": 0}]}],
   "sources": [{"title": "...", "url": "https://...", "kind": "press" | "company" | "filing" | "yc" | "other"}],
   "notStated": ["..."], "highlight": []}}
Up to 8 facts and 8 sources. Change nothing else in the artifact.`;
}

export async function startResearch(note: Note, owner: string, batch: string, context: string): Promise<ResearchResult> {
  if (!ARTIFACT_URL) return { ok: false, reason: "This build doesn't know its own address, so research can't report back." };
  const mcp = await getMcp();
  if (!mcp) return { ok: false, reason: "Background research isn't available in this view." };
  try {
    const envs = (await mcp.callTool(SERVER, "list_environments", { limit: 20 })).payload as {
      environments?: { environment_id: string; state?: string; kind?: string }[];
    };
    const env = envs?.environments?.find((e) => e.state === "active" && e.kind === "anthropic_cloud") ?? envs?.environments?.[0];
    const created = (
      await mcp.callTool(SERVER, "create_session", {
        title: `Batch Signal: ${note.text.slice(0, 60)}`,
        prompt: researchPrompt(note, owner, batch, context),
        ...(env ? { environment_id: env.environment_id } : {}),
      })
    ).payload as Record<string, unknown> | string | undefined;
    const id = typeof created === "object" && created ? (created.session_id ?? created.id ?? (created.session as { id?: string })?.id) : undefined;
    return { ok: true, sessionUrl: typeof id === "string" ? `https://claude.ai/code/${id}` : undefined };
  } catch (e) {
    const code = (e as { code?: string })?.code ?? "";
    if (code === "tool_error") return { ok: false, reason: `Claude couldn't start the session: ${(e as { message?: string }).message ?? "unknown error"}` };
    return { ok: false, reason: REASONS[code] ?? "Couldn't start background research. Try again." };
  }
}
