// Pre-records the tour narration with ElevenLabs into public/voice/.
//   ELEVENLABS_API_KEY=... ELEVENLABS_VOICE_ID=... npm run voice
// Re-run whenever data/groups.json narration changes. Without these files the
// tour runs captions-only.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const key = process.env.ELEVENLABS_API_KEY;
const voice = process.env.ELEVENLABS_VOICE_ID;
const model = process.env.ELEVENLABS_MODEL || "eleven_multilingual_v2";

async function main() {
  if (!key || !voice) {
    console.error("Set ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID. Pick a calm, neutral news-reader voice in the ElevenLabs voice library.");
    process.exit(1);
  }
  const file = JSON.parse(readFileSync(new URL("../data/groups.json", import.meta.url), "utf8")) as {
    overview: string;
    groups: { id: string; narration: string }[];
  };
  const chapters = [{ id: "overview", text: file.overview }, ...file.groups.map((g) => ({ id: g.id, text: g.narration }))];
  const dir = new URL("../public/voice/", import.meta.url);
  mkdirSync(dir, { recursive: true });

  const names: string[] = [];
  for (const [i, ch] of chapters.entries()) {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { "xi-api-key": key, "content-type": "application/json" },
      body: JSON.stringify({
        text: ch.text,
        model_id: model,
        // Steadier delivery suits a briefing; previous/next text keeps the intonation continuous.
        voice_settings: { stability: 0.6, similarity_boost: 0.8, style: 0.1 },
        previous_text: chapters[i - 1]?.text,
        next_text: chapters[i + 1]?.text,
      }),
    });
    if (!res.ok) throw new Error(`ElevenLabs failed on ${ch.id} (HTTP ${res.status}): ${await res.text()}`);
    const name = `${String(i).padStart(2, "0")}-${ch.id}.mp3`;
    writeFileSync(new URL(name, dir), Buffer.from(await res.arrayBuffer()));
    names.push(name);
    console.log(`recorded ${name}`);
  }
  writeFileSync(new URL("manifest.json", dir), JSON.stringify({ chapters: names }, null, 1));
  console.log(`Done: ${names.length} chapters in public/voice/.`);
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
