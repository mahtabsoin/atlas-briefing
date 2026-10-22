# Batch Signal: Atlas

A three-minute, interruptible map of the 230 companies in YC Summer 2026. A narrated tour walks through eight groups; at any point the viewer can click, type or speak to drill in, ask a question, save a note or hand a task to an agent. Answers appear as cards on the page and light up the map.

## How it works

```
Browser                                   Server (Node, one process)
───────                                   ──────────────────────────
Tour  ── pre-written narration            /api/ask    Claude + tools, fixed budget,
Map   ── 230 dots, 8 groups                           NDJSON progress, validated card
Router ─ answers what the snapshot can    /api/speak  ElevenLabs, optional
         (instant, no server)             /api/handoff  POST to your agent, optional
Notes ── local, export, hand off          static dist/
```

**Answer depth.** Every question goes to the shallowest tier that can answer it; only the viewer escalates.

| Tier | Source | Budget | Where |
|---|---|---|---|
| Tour | Narration written from the snapshot | none | browser |
| Dataset | The 230-company snapshot | none | browser (`src/lib/router.ts`) |
| Official sources | Snapshot tools + fetches of the YC profile, company site, SEC | 3 fetches, 6k tokens each, 8 turns | server |
| Web search | Above + search on an allowlist of outlets | 5 searches; the viewer confirms first | server |
| Agent | Your agent, via webhook, or a copied brief | none here | outside the app |

**Grounding rules, enforced in code (`server/ask.ts`):**
- The model answers through one tool, `render_card`, validated against a fixed schema (`shared/card.ts`). The UI renders only that block kit, never model HTML.
- A source survives only if this request actually retrieved it (or it is a YC profile or company website from the snapshot). Facts citing a dropped source lose the citation.
- Company slugs and map highlights must exist in the snapshot.
- A card can't claim a deeper tier than the viewer allowed.
- Domains are allowlisted for fetch and search (`server/search.ts`).

**Groups.** A company joins a group only when its own YC one-liner contains a supporting phrase; that phrase is stored as a character span and highlighted in the UI. 155 of 164 placements have one; 9 are marked judgment calls. `npm run classify` re-runs the grouping with two independent model passes and writes an agreement report (`data/classify-report.md`) for human review.

## Run it

```sh
cd atlas
npm install
cp .env.example .env   # add keys; everything is optional
npm run dev            # API on :8787, app on :5173
```

With no keys, the tour, map, dataset answers and notes all work; live questions say they're switched off.

| Key | Unlocks |
|---|---|
| `ANTHROPIC_API_KEY` | Official-sources and web answers (default model `claude-opus-5-5`, effort `low`) |
| `EXA_API_KEY` | Exa for web search; without it, Claude's built-in web search is used |
| `ELEVENLABS_API_KEY` + `ELEVENLABS_VOICE_ID` | `npm run voice` records narration to `public/voice/`; answers are spoken live |
| `AGENT_WEBHOOK_URL` | "Hand off to agent" POSTs `{task, context, sources}` here; otherwise the brief is copied |

`ASK_LIMIT_PER_HOUR` (default 30) and `SPEAK_LIMIT_PER_HOUR` (default 60) cap spend per visitor.

## Claude artifact edition

```sh
npm run artifact   # -> dist-artifact/batch-signal.html, one self-contained page
```

Publish that file as a Claude artifact with the `sample` and `downloads` capabilities. The tour, map, instant answers and notes work for every viewer. Live questions go to the viewer's own Claude plan (they approve the first one), with the snapshot as Claude's only tool and the same card checks as the server. There is no web search, microphone or recorded narration in this edition; "hand off" copies an agent brief.

## Deploy

One container serves the app and the API:

```sh
docker build -t batch-signal . && docker run -p 8787:8787 --env-file .env batch-signal
```

Works on any host that runs a container (Fly.io, Render, Railway, Cloud Run). Requests answer in about 5–30 s, so use a host without short request timeouts.

## Data

- `data/yc-s26-snapshot.json`: the YC directory snapshot (21 Oct 2026), unchanged.
- `data/groups.json`: group names, rubrics, map positions and narration. Counts in narration are checked against the data at build time.
- `data/assignments.json`: company → group and evidence span.
- `npm run atlas` builds `shared/atlas.generated.json` and fails if any of the above disagree.

To point this at another batch or corpus, replace the snapshot, rewrite `groups.json`, run `npm run classify -- --write`, then `npm run atlas` and `npm run voice`.

## Checks

```sh
npm test         # data consistency, router, answer loop (scripted model), rate limit
npm run build    # typecheck + production bundle
```

## Not yet

- No accounts: notes live in the browser, and the rate limit is per IP and per process.
- Narration audio isn't recorded until you run `npm run voice` with your ElevenLabs key; until then the tour runs on captions.
- Live answers have been tested against a scripted stand-in for the Claude API, not yet against the live API with real keys.
