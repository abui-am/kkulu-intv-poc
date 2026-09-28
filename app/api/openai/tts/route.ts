import { NextResponse } from "next/server";
import { z } from "zod";
import { openaiSpeechStream } from "@/lib/openai/client";
import { MODELS } from "@/lib/openai/models";

const requestSchema = z.object({
  text: z.string().min(1).max(600),
});

export async function POST(request: Request) {
  try {
    const body = requestSchema.parse(await request.json());
    const audio = await openaiSpeechStream({
      model: MODELS.tts,
      voice: "coral",
      input: body.text,
      speed: 1,
      response_format: "pcm",
      stream_format: "audio",
    });
    return new Response(audio, {
      headers: {
        "Content-Type": "audio/pcm",
        "Cache-Control": "no-store",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Speech failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
