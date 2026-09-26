import { NextResponse } from "next/server";
import { z } from "zod";
import { openaiSpeech } from "@/lib/openai/client";
import { MODELS } from "@/lib/openai/models";

const requestSchema = z.object({
  text: z.string().min(1).max(600),
});

export async function POST(request: Request) {
  try {
    const body = requestSchema.parse(await request.json());
    const audio = await openaiSpeech({
      model: MODELS.tts,
      voice: "coral",
      input: body.text,
      instructions: "Speak in English only, calmly and briefly, like a patient onboarding guide.",
      response_format: "mp3",
    });
    return new NextResponse(audio, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Speech failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
