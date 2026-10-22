// Voice input through the browser's speech recognition (Chrome, Edge, Safari).
// Hosted edition only: the Claude artifact frame doesn't allow the microphone.

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
