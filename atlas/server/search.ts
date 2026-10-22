// Web search for the "Web search" tier. Exa is the default: fast, supports
// domain allowlists, and returns page text the model can quote from.

export type SearchHit = { title: string; url: string; published: string | null; text: string };

/** Outlets the web tier may cite, beyond official sources. Edit to taste. */
export const PRESS_ALLOWLIST = [
  "techcrunch.com",
  "reuters.com",
  "bloomberg.com",
  "theinformation.com",
  "axios.com",
  "ft.com",
  "wsj.com",
  "cnbc.com",
  "forbes.com",
  "businessinsider.com",
  "fortune.com",
  "prnewswire.com",
  "businesswire.com",
];

export const OFFICIAL_DOMAINS = ["ycombinator.com", "sec.gov"];

export async function exaSearch(
  query: string,
  includeDomains: string[],
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<SearchHit[]> {
  const res = await fetchImpl("https://api.exa.ai/search", {
    method: "POST",
    headers: { "x-api-key": apiKey, "content-type": "application/json" },
    body: JSON.stringify({
      query,
      type: "fast",
      numResults: 6,
      includeDomains,
      contents: { text: { maxCharacters: 1500 } },
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Exa search failed (HTTP ${res.status})`);
  const body = (await res.json()) as { results?: { title?: string; url: string; publishedDate?: string; text?: string }[] };
  return (body.results ?? []).map((r) => ({
    title: r.title ?? r.url,
    url: r.url,
    published: r.publishedDate ?? null,
    text: (r.text ?? "").slice(0, 1500),
  }));
}

export const hostOf = (url: string | null): string | null => {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
};
