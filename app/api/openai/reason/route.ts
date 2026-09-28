import { NextResponse } from "next/server";
import { z } from "zod";
import { routeModel } from "@/lib/agent/router";
import { extractOutputText, openaiJson, parseModelJson } from "@/lib/openai/client";
import { modelForReasoner, MODELS } from "@/lib/openai/models";
import { buildDeepReasonerPrompt, buildFastReasonerPrompt } from "@/prompts/fast-reasoner";
import { ScreenElementSchema } from "@/schemas/screen-state";
import { AgentDecisionSchema, agentDecisionJsonSchema, type AgentDecision } from "@/schemas/agent-decision";
import type { ReasoningContext } from "@/lib/agent/context-builder";

const contextSchema = z.object({
  sessionObjective: z.string(),
  workflow: z.object({
    currentStep: z.string(),
    completedSteps: z.array(z.string()),
    skippedSteps: z.array(z.string()),
    expectedNextState: z.string().optional(),
  }),
  latestUserUtterance: z.string().nullable(),
  screen: z.object({
    version: z.number(),
    page: z.string().nullable(),
    summary: z.string().nullable(),
    relevantElements: z.array(ScreenElementSchema),
    perceptionStatus: z.enum(["unknown", "clear", "ambiguous"]),
    available: z.boolean(),
    previousPage: z.string().nullable().optional().transform((value) => value ?? null),
  }),
  recentRelevantConversation: z.array(z.string()).max(4),
  lastInstruction: z.string().nullable(),
  activeQuestion: z.string().nullable(),
  discrepancy: z.object({ expected: z.string(), observed: z.string() }).optional(),
  reflection: z.object({
    decisionId: z.string(),
    subgoal: z.string(),
    expectedPage: z.string(),
    observedPage: z.string().nullable(),
    status: z.enum(["consistent", "mismatch", "unavailable"]),
    result: z.object({
      consistent: z.boolean(),
      beforeDescription: z.string(),
      afterDescription: z.string(),
      observedChange: z.string(),
      alignment: z.string(),
    }).nullable(),
  }).nullable(),
  guide: z.union([
    z.object({
      kind: z.literal("action"),
      page: z.enum(["Dashboard", "Settings", "Integrations", "GitHub Integration", "GitHub Authorization", "GitHub Connected", "API Keys", "Loading"]),
      stepId: z.enum(["openSettings", "openIntegrations", "selectGithub", "authorizeGithub", "verifyConnection"]).nullable(),
      target: z.string(),
      instruction: z.string(),
      expectedPage: z.string(),
    }),
    z.object({
      kind: z.enum(["wait", "clarify", "reconnect", "complete"]),
      instruction: z.string(),
    }),
  ]).nullable(),
});

const requestSchema = z.object({
  context: contextSchema,
  signals: z.object({
    perceptionStatus: z.enum(["unknown", "clear", "ambiguous"]),
    conflictingEvidence: z.boolean(),
    recoveryAttempts: z.number(),
    userChangedGoal: z.boolean(),
  }),
});

async function structured<T>(input: {
  prompt: string;
  name: string;
  jsonSchema: Record<string, unknown>;
  schema: z.ZodType<T>;
  model?: string;
  signal?: AbortSignal;
}): Promise<T> {
  const payload = await openaiJson<{
    output_text?: string;
    output?: Array<{ content?: Array<{ text?: string }> }>;
  }>(
    "/responses",
    {
      model: input.model ?? MODELS.fastReasoner,
      input: [{
        role: "user",
        content: [{ type: "input_text", text: input.prompt }],
      }],
      text: {
        format: {
          type: "json_schema",
          name: input.name,
          strict: true,
          schema: input.jsonSchema,
        },
      },
    },
    input.signal,
  );
  return input.schema.parse(parseModelJson(extractOutputText(payload)));
}

async function directDecision(context: ReasoningContext, model: string, signal?: AbortSignal): Promise<AgentDecision> {
  return structured({
    prompt: model === MODELS.deepReasoner
      ? buildDeepReasonerPrompt(context)
      : buildFastReasonerPrompt(context),
    name: "agent_decision",
    jsonSchema: agentDecisionJsonSchema,
    schema: AgentDecisionSchema,
    model,
    signal,
  });
}

export async function POST(request: Request) {
  try {
    const body = requestSchema.parse(await request.json());
    const context: ReasoningContext = body.context;
    const directRoute = routeModel(body.signals);
    const first = await directDecision(context, modelForReasoner(directRoute), AbortSignal.any([AbortSignal.timeout(10_000), request.signal]));
    const decision = directRoute === "fast" && first.requiresDeepReasoning
      ? await directDecision(context, modelForReasoner("deep"), AbortSignal.any([AbortSignal.timeout(10_000), request.signal]))
      : first;
    const model = directRoute === "fast" && first.requiresDeepReasoning ? "deep" : directRoute;
    return NextResponse.json({ decision, model });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Reasoning failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
