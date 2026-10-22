// Voice in: the browser's speech recognition (Chrome, Edge, Safari).
// Voice out: narration recorded ahead of time, and spoken answers from the server.

type Recognition = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
};

const Ctor = (): (new () => Recognition) | null => {
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as (new () => Recognition) | null;
};

export const canListen = () => typeof window !== "undefined" && Ctor() !== null;

/** Resolves with what was said, or null if nothing was heard. */
export function listen(): { result: Promise<string | null>; stop: () => void } {
  const C = Ctor();
  if (!C) return { result: Promise.resolve(null), stop: () => {} };
  const rec = new C();
  rec.lang = "en-US";
  rec.interimResults = false;
  rec.maxAlternatives = 1;
  const result = new Promise<string | null>((resolve) => {
    let heard: string | null = null;
    rec.onresult = (e) => {
      heard = e.results[0]?.[0]?.transcript ?? null;
    };
    rec.onerror = () => resolve(null);
    rec.onend = () => resolve(heard);
  });
  rec.start();
  return { result, stop: () => rec.stop() };
}

export type VoiceManifest = { chapters: string[] };

/** Narration files produced by `npm run voice`. Absent means captions only. */
export async function loadManifest(): Promise<VoiceManifest | null> {
  try {
    const res = await fetch("/voice/manifest.json");
    if (!res.ok) return null;
    const m = (await res.json()) as VoiceManifest;
    return Array.isArray(m.chapters) && m.chapters.length ? m : null;
  } catch {
    return null;
  }
}

let answerAudio: HTMLAudioElement | null = null;

export async function speakAnswer(text: string): Promise<void> {
  stopAnswer();
  try {
    const res = await fetch("/api/speak", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) return;
    const url = URL.createObjectURL(await res.blob());
    answerAudio = new Audio(url);
    answerAudio.onended = () => URL.revokeObjectURL(url);
    await answerAudio.play();
  } catch {
    // Speaking is a nicety; the card already shows the answer.
  }
}

export function stopAnswer() {
  answerAudio?.pause();
  answerAudio = null;
}
