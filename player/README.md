# Player

The page every atlas runs in. React + Vite, built once into `../skills/atlas-briefing/assets/player.html`; the skill's `build.mjs` inlines a collection into it.

```bash
npm install
npm run dev                         # YC 2026 example at http://localhost:5173
ATLAS=path/to/collection.json npm run dev
npm test                            # builder checks + instant-answer router
npm run release                     # typecheck, then rebuild the skill's player.html
```

Layout: `src/` UI, `shared/` data model, card schema and queries, `tests/`.
Outside Claude the page still works (paging, filter, quick facts); handing picks to a chat needs the `room` capability, and falls back to copying text.
