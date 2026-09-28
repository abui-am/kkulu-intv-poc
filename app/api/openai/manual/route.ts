import { NextResponse } from "next/server";
import { z } from "zod";
import { extractOutputText, openaiJson, parseModelJson } from "@/lib/openai/client";
import { MODELS } from "@/lib/openai/models";
import { buildManualPrompt } from "@/prompts/manual";
import { DESTINATION_PAGES, MANUAL_PAGES } from "@/lib/workflow/manual";

const blockerSchema = z.object({
  label: z.string().trim().min(1).max(80),
  summary: z.string().trim().min(1).max(240),
  instruction: z.string().trim().min(1).max(240),
});

const stepSchema = z.object({
  page: z.enum(MANUAL_PAGES),
  target: z.string().trim().min(1).max(80),
  expectedPage: z.enum(DESTINATION_PAGES),
  instruction: z.string().trim().min(1).max(400),
  blockers: z.array(blockerSchema).max(4),
  confirmSuccess: z.string().trim().max(200),
  confirmFailure: z.string().trim().max(200),
  confirmDone: z.string().trim().max(200),
  confirmChecking: z.string().trim().max(200),
  confirmMissing: z.string().trim().max(200),
});

function phrases(value: string): string[] {
  return value.split(",").map((phrase) => phrase.trim()).filter(Boolean);
}

const conversionSchema = z.object({
  steps: z.array(stepSchema).min(1).max(MANUAL_PAGES.length),
});

const conversionJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    steps: {
      type: "array",
      minItems: 1,
      maxItems: MANUAL_PAGES.length,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          page: { type: "string", enum: [...MANUAL_PAGES] },
          target: { type: "string" },
          expectedPage: { type: "string", enum: [...DESTINATION_PAGES] },
          instruction: { type: "string" },
          blockers: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                label: { type: "string" },
                summary: { type: "string" },
                instruction: { type: "string" },
              },
              required: ["label", "summary", "instruction"],
            },
          },
          confirmSuccess: { type: "string" },
          confirmFailure: { type: "string" },
          confirmDone: { type: "string" },
          confirmChecking: { type: "string" },
          confirmMissing: { type: "string" },
        },
        required: ["page", "target", "expectedPage", "instruction", "blockers", "confirmSuccess", "confirmFailure", "confirmDone", "confirmChecking", "confirmMissing"],
      },
    },
  },
  required: ["steps"],
} as const;

const requestSchema = z.object({
  manual: z.string().trim().min(1).max(12_000),
});

export async function POST(request: Request) {
  try {
    const body = requestSchema.parse(await request.json());
    const payload = await openaiJson<{ output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }> }>(
      "/responses",
      {
        model: MODELS.fastReasoner,
        input: [{ role: "user", content: [{ type: "input_text", text: buildManualPrompt(body.manual) }] }],
        text: {
          format: {
            type: "json_schema",
            name: "manual_steps",
            strict: true,
            schema: conversionJsonSchema,
          },
        },
      },
      AbortSignal.any([AbortSignal.timeout(60_000), request.signal]),
    );
    const conversion = conversionSchema.parse(parseModelJson(extractOutputText(payload)));
    const seen = new Set<string>();
    const steps = conversion.steps.filter((step) => {
      if (seen.has(step.page)) return false;
      seen.add(step.page);
      return true;
    }).map((step) => {
      const success = phrases(step.confirmSuccess);
      return {
        page: step.page,
        target: step.target,
        expectedPage: step.expectedPage,
        instruction: step.instruction,
        blockers: step.blockers,
        ...(success.length > 0 ? {
          confirm: {
            done: step.confirmDone || `You're all set. ${body.manual.split("\n").map((line) => line.trim()).find(Boolean) ?? "This is finished."}`,
            checking: step.confirmChecking || "Hang on, I'm checking that this finished.",
            missing: step.confirmMissing || "I don't see the success message yet. Leave that page up so I can check.",
            success,
            failure: phrases(step.confirmFailure),
          },
        } : {}),
      };
    });
    if (steps.length === 0) {
      return NextResponse.json({ error: "The manual did not name a step." }, { status: 422 });
    }
    return NextResponse.json({ steps });
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    const message = timedOut
      ? "Reading the manual took too long. Save again."
      : error instanceof Error ? error.message : "Could not read the manual";
    return NextResponse.json({ error: message }, { status: timedOut ? 504 : 500 });
  }
}
