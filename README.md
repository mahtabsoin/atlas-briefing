# Batch Signal

Batch reference: `yc__s26` (YC Summer 2026).

An interactive YC startup explorer with narrated scenes, startup filters, and an ElevenLabs conversational host that can navigate the experience while answering questions.

## Status

This is a prototype. The dataset covers 230 publicly listed YC Summer 2026 startups, collected October 21, 2026, with YC source links. Missing funding or traction is unknown, not zero.

- Play story uses browser SpeechSynthesis.
- Live conversation uses ElevenLabs Agents, configured with `eleven_flash_v2_5` and `gpt-5.4-mini`. No explicit voice ID is configured.
- The live credential flow has not yet been validated end to end with an ElevenLabs API key.

## Development

Requires Node.js >=22.13 and pnpm 11.25.0.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open the URL printed by the server. Portable local development sign-in is available at `/signin-with-chatgpt?return_to=/`. Run `pnpm build` to build. See [starter documentation](docs/sites-starter.md) for framework and deployment details.

## Source map

- `public/app.js`: playback, filters, conversational client tools.
- `public/data.json`: startup dataset and sources.
- `public/style.css`: presentation styles.
- `public/elevenlabs.js`: bundled ElevenLabs browser client.
- `app/player-markup.ts`, `app/player.tsx`: player shell.
- `app/api/voice/route.ts`: agent creation and signed conversation URLs.

## Voice and deployment

Use the private setup form to provide your ElevenLabs API key. The server forwards it to ElevenLabs; the app does not persist the key. The agent ID is saved in local storage. Never commit credentials or expose them in frontend environment variables.

Built for ChatGPT Sites using Vinext, React, Vite, and Cloudflare Workers. The voice route relies on Sites-provided identity headers. Deployment elsewhere requires verified server-side authentication; never trust client-supplied identity headers. The original hosting project binding is omitted from this export.

## Provenance

Independent snapshot of Sites commit `0c82ceb64ed008c3889a3a48d5b97d1d46c2a230`. GitHub pushes do not automatically redeploy the existing Site. Third-party notices are preserved under `vendor/` and the starter scripts. YC company content remains attributable to its original sources.
