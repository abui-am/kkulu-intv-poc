import { NextResponse } from "next/server";
import { z } from "zod";
import { extractOutputText, openaiJson, parseModelJson } from "@/lib/openai/client";
import { MODELS } from "@/lib/openai/models";
import { buildScreenPerceptionPrompt } from "@/prompts/screen-perception";
import { ScreenStateSchema, screenStateJsonSchema } from "@/schemas/screen-state";

const requestSchema = z.object({
  imageDataUrl: z.string().min(1).max(6_000_000),
  goal: z.string().optional(),
  currentStep: z.string(),
  expectedNextState: z.string().optional(),
  previousScreenSummary: z.string().nullable(),
  expectedTarget: z.string().nullable().optional(),
});

export async function POST(request: Request) {
  try {
    const body = requestSchema.parse(await request.json());
    const prompt = buildScreenPerceptionPrompt({
      goal: body.goal,
      currentStep: body.currentStep,
      expectedNextState: body.expectedNextState,
      previousScreenSummary: body.previousScreenSummary,
      expectedTarget: body.expectedTarget ?? null,
    });
    const payload = await openaiJson<{ output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }> }>(
      "/responses",
      {
        model: MODELS.perception,
        input: [
          {
            role: "user",
            content: [
              { type: "input_text", text: prompt },
              { type: "input_image", image_url: body.imageDataUrl, detail: "low" },
            ],
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "screen_state",
            strict: true,
            schema: screenStateJsonSchema,
          },
        },
      },
    );
    const screen = ScreenStateSchema.parse(parseModelJson(extractOutputText(payload)));
    return NextResponse.json({ screen });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Perception failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
