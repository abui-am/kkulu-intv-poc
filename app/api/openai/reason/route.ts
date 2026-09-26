import { NextResponse } from "next/server";
import { z } from "zod";
import { buildPredictionTree, isLookaheadEligible, orderCandidates } from "@/lib/agent/lookahead";
import { routeModel } from "@/lib/agent/router";
import { extractOutputText, openaiJson, parseModelJson } from "@/lib/openai/client";
import { modelForReasoner, MODELS } from "@/lib/openai/models";
import {
  buildCandidatePrompt,
  buildFollowUpPrompt,
  buildPredictionPrompt,
  buildSelectionPrompt,
} from "@/prompts/lookahead";
import { buildDeepReasonerPrompt, buildFastReasonerPrompt } from "@/prompts/fast-reasoner";
import {
  CandidateSetJsonSchema,
  CandidateSetSchema,
  FollowUpBatchJsonSchema,
  FollowUpBatchSchema,
  PredictionBatchJsonSchema,
  PredictionBatchSchema,
  RolloutSchema,
  RolloutSelectionJsonSchema,
  RolloutSelectionSchema,
  type Rollout,
  type RolloutBranch,
} from "@/schemas/lookahead";
import { ScreenElementSchema } from "@/schemas/screen-state";
import { AgentDecisionSchema, agentDecisionJsonSchema, type AgentDecision } from "@/schemas/agent-decision";
import type { ReasoningContext } from "@/lib/agent/context-builder";

type CallStats = { modelCalls: number; candidateCount: number };

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
    relevantElements: z.array(ScreenElementSchema),
    perceptionStatus: z.enum(["unknown", "clear", "ambiguous"]),
    available: z.boolean(),
    previousPage: z.string().nullable().optional().transform((value) => value ?? null),
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
  imageDataUrl: z.string().min(1).max(6_000_000).optional(),
  allowLookahead: z.boolean().optional().default(true),
});

async function structured<T>(input: {
  prompt: string;
  name: string;
  jsonSchema: Record<string, unknown>;
  schema: z.ZodType<T>;
  model?: string;
  imageDataUrl?: string;
  signal?: AbortSignal;
  stats?: CallStats;
}): Promise<T> {
  if (input.stats) input.stats.modelCalls += 1;
  const content = [{ type: "input_text", text: input.prompt }];
  const payload = await openaiJson<{
    output_text?: string;
    output?: Array<{ content?: Array<{ text?: string }> }>;
  }>(
    "/responses",
    {
      model: input.model ?? MODELS.fastReasoner,
      input: [{
        role: "user",
        content: input.imageDataUrl
          ? [...content, { type: "input_image", image_url: input.imageDataUrl, detail: "auto" }]
          : content,
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

async function directDecision(context: ReasoningContext, model: string, signal?: AbortSignal, stats?: CallStats): Promise<AgentDecision> {
  return structured({
    prompt: model === MODELS.deepReasoner
      ? buildDeepReasonerPrompt(context)
      : buildFastReasonerPrompt(context),
    name: "agent_decision",
    jsonSchema: agentDecisionJsonSchema,
    schema: AgentDecisionSchema,
    model,
    signal,
    stats,
  });
}

function assertIds(expectedIds: string[], returnedIds: string[], stage: string): void {
  const expected = [...expectedIds].sort();
  const returned = [...returnedIds].sort();
  if (expected.length !== returned.length || expected.some((id, index) => id !== returned[index])) {
    throw new Error(`${stage} did not return exactly one result for each candidate`);
  }
}

async function makeRollout(context: ReasoningContext, imageDataUrl: string, signal: AbortSignal, stats: CallStats, startedAt: number): Promise<{
  decision: AgentDecision;
  model: "fast" | "deep";
  rollout: Rollout;
}> {
  const candidates = orderCandidates((await structured({
    prompt: buildCandidatePrompt(context),
    name: "lookahead_candidates",
    jsonSchema: CandidateSetJsonSchema,
    schema: CandidateSetSchema,
    signal,
    stats,
  })).candidates);
  stats.candidateCount = candidates.length;
  const candidateIds = candidates.map((candidate) => candidate.id);

  const firstBatch = await structured({
    prompt: buildPredictionPrompt({ context, actions: candidates }),
    name: "lookahead_first_states",
    jsonSchema: PredictionBatchJsonSchema,
    schema: PredictionBatchSchema,
    signal,
    stats,
  });
  assertIds(candidateIds, firstBatch.predictions.map((item) => item.candidateId), "First forecast");

  const followUpBatch = await structured({
    prompt: buildFollowUpPrompt({
      context,
      branches: candidates.map((candidate) => ({
        candidateId: candidate.id,
        firstAction: candidate,
        predictedState: firstBatch.predictions.find((item) => item.candidateId === candidate.id)!.state,
      })),
    }),
    name: "lookahead_follow_ups",
    jsonSchema: FollowUpBatchJsonSchema,
    schema: FollowUpBatchSchema,
    signal,
    stats,
  });
  assertIds(candidateIds, followUpBatch.followUps.map((item) => item.candidateId), "Follow-up generation");

  const followUps = followUpBatch.followUps.map((item) => ({ ...item.action, id: item.candidateId }));
  const secondBatch = await structured({
    prompt: buildPredictionPrompt({
      context,
      actions: followUps,
      currentScreens: followUps.map((action) => ({
        candidateId: action.id,
        state: firstBatch.predictions.find((item) => item.candidateId === action.id)!.state,
      })),
    }),
    name: "lookahead_second_states",
    jsonSchema: PredictionBatchJsonSchema,
    schema: PredictionBatchSchema,
    signal,
    stats,
  });
  assertIds(candidateIds, secondBatch.predictions.map((item) => item.candidateId), "Second forecast");

  const confidenceFloor = 0.4;
  const branches: RolloutBranch[] = candidates.map((candidate) => {
    const firstState = firstBatch.predictions.find((item) => item.candidateId === candidate.id)!.state;
    const followUp = followUpBatch.followUps.find((item) => item.candidateId === candidate.id)!.action;
    const secondState = secondBatch.predictions.find((item) => item.candidateId === candidate.id)!.state;
    const valid = firstState.confidence >= confidenceFloor && secondState.confidence >= confidenceFloor;
    return {
      candidate,
      predictedState: firstState,
      followUp,
      secondPredictedState: secondState,
      valid,
      invalidReason: valid ? null : `confidence below ${confidenceFloor}`,
    };
  });
  const validBranches = branches.filter((branch) => branch.valid);
  if (!validBranches.length) throw new Error("All predicted branches were below the confidence threshold");

  const tree = buildPredictionTree(validBranches);
  const route = routeModel({
    perceptionStatus: context.screen.perceptionStatus,
    conflictingEvidence: false,
    recoveryAttempts: 0,
    userChangedGoal: false,
  });
  const selection = await structured({
    prompt: buildSelectionPrompt({ context, tree }),
    name: "lookahead_selection",
    jsonSchema: RolloutSelectionJsonSchema,
    schema: RolloutSelectionSchema,
    model: modelForReasoner(route),
    imageDataUrl,
    signal,
    stats,
  });
  const selected = validBranches.find((branch) => branch.candidate.id === selection.candidateId);
  if (!selected) throw new Error("Selector returned a candidate outside the valid prediction tree");

  const decision: AgentDecision = {
    id: crypto.randomUUID(),
    type: selected.candidate.type,
    basedOnScreenVersion: context.screen.version,
    target: selected.candidate.target || undefined,
    expectedScreenState: selected.candidate.expectedScreenState || undefined,
    response: selected.candidate.instruction,
    reasoningClass: selected.candidate.type === "recover" ? "deviation" : "normal_flow",
    requiresDeepReasoning: false,
  };
  return {
    decision,
    model: route,
    rollout: RolloutSchema.parse({
      basedOnScreenVersion: context.screen.version,
      candidateCount: candidates.length,
      branches,
      selectedCandidateId: selected.candidate.id,
      selectionRationale: selection.rationale,
      modelCalls: stats.modelCalls,
      latencyMs: Date.now() - startedAt,
      status: "completed",
      fallbackReason: null,
    }),
  };
}

export async function POST(request: Request) {
  try {
    const body = requestSchema.parse(await request.json());
    const context: ReasoningContext = body.context;
    const eligible = body.allowLookahead && Boolean(body.imageDataUrl) && isLookaheadEligible(context, {
      perceptionStatus: body.signals.perceptionStatus,
      conflictingEvidence: body.signals.conflictingEvidence,
      userChangedGoal: body.signals.userChangedGoal,
    });

    let rollout: Rollout | null = null;
    let decision: AgentDecision;
    let model: "fast" | "deep";

    if (eligible && body.imageDataUrl) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort("lookahead timed out"), 20_000);
      const stats: CallStats = { modelCalls: 0, candidateCount: 0 };
      const startedAt = Date.now();
      const signal = AbortSignal.any([controller.signal, request.signal]);
      try {
        const result = await makeRollout(context, body.imageDataUrl, signal, stats, startedAt);
        decision = result.decision;
        model = result.model;
        rollout = result.rollout;
      } catch (error) {
        controller.abort();
        if (request.signal.aborted) {
          return NextResponse.json({ error: "Request cancelled" }, { status: 499 });
        }
        const reason = error instanceof Error ? error.message : "Lookahead failed";
        const directRoute = routeModel(body.signals);
        decision = await directDecision(context, modelForReasoner(directRoute), AbortSignal.any([AbortSignal.timeout(10_000), request.signal]), stats);
        model = directRoute;
        rollout = RolloutSchema.parse({
          basedOnScreenVersion: context.screen.version,
          candidateCount: stats.candidateCount,
          branches: [],
          selectedCandidateId: null,
          selectionRationale: null,
          modelCalls: stats.modelCalls,
          latencyMs: Date.now() - startedAt,
          status: "fallback",
          fallbackReason: reason,
        });
      } finally {
        clearTimeout(timeout);
      }
    } else {
      const directRoute = routeModel(body.signals);
      const stats: CallStats = { modelCalls: 0, candidateCount: 0 };
      const startedAt = Date.now();
      const first = await directDecision(context, modelForReasoner(directRoute), AbortSignal.any([AbortSignal.timeout(10_000), request.signal]), stats);
      if (directRoute === "fast" && first.requiresDeepReasoning) {
        decision = await directDecision(context, modelForReasoner("deep"), AbortSignal.any([AbortSignal.timeout(10_000), request.signal]), stats);
        model = "deep";
      } else {
        decision = first;
        model = directRoute;
      }
      const bypassReason = !body.allowLookahead
        ? "lookahead disabled"
        : !body.imageDataUrl
          ? "current screenshot unavailable"
          : "turn is not eligible for lookahead";
      rollout = RolloutSchema.parse({
        basedOnScreenVersion: context.screen.version,
        candidateCount: 0,
        branches: [],
        selectedCandidateId: null,
        selectionRationale: null,
        modelCalls: stats.modelCalls,
        latencyMs: Date.now() - startedAt,
        status: "bypassed",
        fallbackReason: bypassReason,
      });
    }

    return NextResponse.json({ decision, model, rollout });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Reasoning failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
