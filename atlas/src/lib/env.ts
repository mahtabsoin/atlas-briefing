// Which edition this bundle is: the hosted web app, or the Claude artifact
// (live questions on the viewer's own Claude plan, no server).
export const ARTIFACT = import.meta.env.VITE_TARGET === "artifact";

type Sample = ((input: string, options?: Record<string, unknown>) => Promise<{ text: string }>) & {
  json: <T = unknown>(input: string, options?: Record<string, unknown>) => Promise<T>;
};
type Downloads = { save(req: { filename: string; data: string }): Promise<{ status: string }> };
type ClaudeRuntime = { use(name: string): Promise<unknown> };

const runtime = (): ClaudeRuntime | null => (window as unknown as { claude?: ClaudeRuntime }).claude ?? null;

/** Resolves null wherever this view can't ask Claude. */
export async function getSample(): Promise<Sample | null> {
  try {
    return ((await runtime()?.use("sample")) as Sample | null) ?? null;
  } catch {
    return null;
  }
}

export async function getDownloads(): Promise<Downloads | null> {
  try {
    return ((await runtime()?.use("downloads")) as Downloads | null) ?? null;
  } catch {
    return null;
  }
}

export type { Sample };
