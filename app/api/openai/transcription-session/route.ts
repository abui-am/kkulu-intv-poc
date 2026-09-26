import { NextResponse } from "next/server";
import { MODELS } from "@/lib/openai/models";
import { requireApiKey } from "@/lib/openai/client";

export async function POST() {
  try {
    const response = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${requireApiKey()}`,
        "Content-Type": "application/json",
        "OpenAI-Safety-Identifier": "kulu-mvp-prototype",
      },
      body: JSON.stringify({
        session: {
          type: "transcription",
          audio: {
            input: {
              transcription: {
                model: MODELS.transcription,
                prompt: "English only. A user onboarding a SaaS product and connecting GitHub.",
                languages: ["en"],
              },
              turn_detection: null,
            },
          },
        },
      }),
    });
    const payload: unknown = await response.json();
    if (!response.ok) {
      return NextResponse.json({ error: payload }, { status: response.status });
    }
    const record = payload as { value?: string; client_secret?: { value?: string } };
    const value = record.value ?? record.client_secret?.value;
    if (!value) {
      return NextResponse.json({ error: "No ephemeral credential returned" }, { status: 502 });
    }
    return NextResponse.json({ value });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create transcription session";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
