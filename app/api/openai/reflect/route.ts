import { NextResponse } from "next/server";
import { z } from "zod";
import { extractOutputText, openaiJson, parseModelJson } from "@/lib/openai/client";
import { MODELS } from "@/lib/openai/models";
import { buildReflectionPrompt } from "@/prompts/reflection";
import { ReflectionInputSchema, ReflectionResultSchema, reflectionResultJsonSchema } from "@/schemas/reflection";

const requestSchema = z.object({
  transition: ReflectionInputSchema,
  beforeImage: z.string().startsWith("data:image/jpeg;base64,").max(6_000_000),
  afterImage: z.string().startsWith("data:image/jpeg;base64,").max(6_000_000),
});

export async function POST(request: Request) {
  try {
    const body = requestSchema.parse(await request.json());
    const payload = await openaiJson<{ output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }> }>(
      "/responses",
      {
        model: MODELS.perception,
        input: [{
          role: "user",
          content: [
            { type: "input_text", text: buildReflectionPrompt(body.transition) },
            { type: "input_image", image_url: body.beforeImage, detail: "auto" },
            { type: "input_image", image_url: body.afterImage, detail: "auto" },
          ],
        }],
        text: {
          format: {
            type: "json_schema",
            name: "transition_reflection",
            strict: true,
            schema: reflectionResultJsonSchema,
          },
        },
      },
      request.signal,
    );
    return NextResponse.json({ reflection: ReflectionResultSchema.parse(parseModelJson(extractOutputText(payload))) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Reflection failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
