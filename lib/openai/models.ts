export const MODELS = {
  perception: "gpt-6-luna",
  fastReasoner: "gpt-6-luna",
  deepReasoner: "gpt-6-sol",
  transcription: "gpt-live-transcribe",
  tts: "gpt-4o-mini-tts",
} as const;

export type ReasonerModel = "fast" | "deep";

export function modelForReasoner(route: ReasonerModel): string {
  return route === "deep" ? MODELS.deepReasoner : MODELS.fastReasoner;
}
