// Which edition this bundle is, and typed access to the Claude artifact runtime.
// Every capability may be absent; callers design for null.
export const ARTIFACT = import.meta.env.VITE_TARGET === "artifact";
/** The published artifact's own address, so background research can write back to it. */
export const ARTIFACT_URL: string = import.meta.env.VITE_ARTIFACT_URL ?? "";

type Sample = ((input: string, options?: Record<string, unknown>) => Promise<{ text: string }>) & {
  json: <T = unknown>(input: string, options?: Record<string, unknown>) => Promise<T>;
};
type Downloads = { save(req: { filename: string; data: string }): Promise<{ status: string }> };
type Mcp = { callTool(server: string, tool: string, input?: unknown): Promise<{ payload?: unknown }> };
type User = { id(): Promise<string | null> };
type Snap = { id: string; exists: boolean; data(): Record<string, unknown> | undefined };
type QuerySnap = { docs: Snap[] };
type Query = {
  where(field: string, op: string, value: unknown): Query;
  onSnapshot(next: (s: QuerySnap) => void, error?: (e: { code: string }) => void): () => void;
};
type Collection = Query & { doc(id: string): { set(d: Record<string, unknown>): Promise<void>; update(d: Record<string, unknown>): Promise<void>; delete(): Promise<void> } };
type Db = { collection(path: string): Collection };

type ClaudeRuntime = { use(name: string): Promise<unknown> };
const runtime = (): ClaudeRuntime | null => (ARTIFACT ? ((window as unknown as { claude?: ClaudeRuntime }).claude ?? null) : null);

async function use<T>(name: string): Promise<T | null> {
  try {
    return ((await runtime()?.use(name)) as T | null) ?? null;
  } catch {
    return null;
  }
}

export const getSample = () => use<Sample>("sample");
export const getDownloads = () => use<Downloads>("downloads");
export const getMcp = () => use<Mcp>("mcp");
export const getDb = () => use<Db>("db");
export async function getUserId(): Promise<string | null> {
  const user = await use<User>("user");
  try {
    return (await user?.id()) ?? null;
  } catch {
    return null;
  }
}

export type { Db, Mcp, Sample };
