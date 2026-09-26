import { NextResponse } from "next/server";
import { z } from "zod";
import { routeModel } from "@/lib/agent/router";
import { extractOutputText, openaiJson, parseModelJson } from "@/lib/openai/client";
import { modelForReasoner } from "@/lib/openai/models";
import { buildDeepReasonerPrompt, buildFastReasonerPrompt } from "@/prompts/fast-reasoner";
import { AgentDecisionSchema, agentDecisionJsonSchema } from "@/schemas/agent-decision";

const contextSchema = z.object({
  sessionObjective: z.string(),
  workflow: z.object({
    currentStep: z.string(),
    completedSteps: z.array(z.string()),
    expectedNextState: z.string().optional(),
  }),
  latestUserUtterance: z.string().nullable(),
  screen: z.object({
    version: z.number(),
    page: z.string().nullable(),
    summary: z.string().nullable(),
    relevantElements: z.array(
      z.object({ label: z.string(), role: z.string(), state: z.string().optional() }),
    ),
    perceptionStatus: z.enum(["unknown", "clear", "ambiguous"]),
    available: z.boolean(),
  }),
  recentRelevantConversation: z.array(z.string()).max(4),
  lastInstruction: z.string().nullable(),
  activeQuestion: z.string().nullable(),
  discrepancy: z.object({ expected: z.string(), observed: z.string() }).optional(),
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

async function complete(prompt: string, model: string) {
  const payload = await openaiJson<{
    output_text?: string;
    output?: Array<{ content?: Array<{ text?: string }> }>;
  }>("/responses", {
    model,
    input: [{ role: "user", content: prompt }],
    text: {
      format: {
        type: "json_schema",
        name: "agent_decision",
        strict: true,
        schema: agentDecisionJsonSchema,
      },
    },
  });
  const parsed = AgentDecisionSchema.parse(parseModelJson(extractOutputText(payload)));
  return {
    ...parsed,
    id: parsed.id || crypto.randomUUID(),
    target: parsed.target || undefined,
    expectedScreenState: parsed.expectedScreenState || undefined,
  };
}

export async function POST(request: Request) {
  try {
    const body = requestSchema.parse(await request.json());
    let route = routeModel({
      perceptionStatus: body.signals.perceptionStatus,
      conflictingEvidence: body.signals.conflictingEvidence,
      recoveryAttempts: body.signals.recoveryAttempts,
      userChangedGoal: body.signals.userChangedGoal,
    });
    const prompt =
      route === "deep"
        ? buildDeepReasonerPrompt(body.context)
        : buildFastReasonerPrompt(body.context);
    let decision = await complete(prompt, modelForReasoner(route));
    if (route === "fast" && decision.requiresDeepReasoning) {
      route = "deep";
      decision = await complete(buildDeepReasonerPrompt(body.context), modelForReasoner("deep"));
    }
    return NextResponse.json({ decision, model: route });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Reasoning failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
