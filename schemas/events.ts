import { z } from "zod";
import { AgentDecisionSchema } from "@/schemas/agent-decision";
import { ScreenStateSchema } from "@/schemas/screen-state";

const workflowStepId = z.enum([
  "openSettings",
  "openIntegrations",
  "selectGithub",
  "authorizeGithub",
  "verifyConnection",
]);

export const SessionEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("SESSION_STARTED"), at: z.number() }),
  z.object({ type: z.literal("USER_SPEECH_STARTED"), at: z.number() }),
  z.object({
    type: z.literal("USER_TRANSCRIPT_PARTIAL"),
    text: z.string(),
    itemId: z.string(),
    at: z.number(),
  }),
  z.object({
    type: z.literal("USER_TRANSCRIPT_FINAL"),
    text: z.string(),
    itemId: z.string(),
    at: z.number(),
  }),
  z.object({
    type: z.literal("FRAME_SAMPLED"),
    frameVersion: z.number(),
    changeRatio: z.number(),
    at: z.number(),
  }),
  z.object({ type: z.literal("SCREEN_CHANGE_CANDIDATE"), at: z.number() }),
  z.object({
    type: z.literal("SCREEN_STABILIZED"),
    imageId: z.string(),
    at: z.number(),
  }),
  z.object({
    type: z.literal("SCREEN_STATE_UPDATED"),
    screen: ScreenStateSchema,
    semanticVersion: z.number(),
    at: z.number(),
  }),
  z.object({ type: z.literal("SCREEN_UNAVAILABLE"), at: z.number() }),
  z.object({
    type: z.literal("REASONING_STARTED"),
    basedOnScreenVersion: z.number(),
    at: z.number(),
  }),
  z.object({
    type: z.literal("LOOKAHEAD_STARTED"),
    basedOnScreenVersion: z.number(),
    at: z.number(),
  }),
  z.object({
    type: z.literal("LOOKAHEAD_RESULT"),
    basedOnScreenVersion: z.number(),
    status: z.enum(["completed", "bypassed", "fallback"]),
    candidateCount: z.number(),
    validBranchCount: z.number(),
    modelCalls: z.number(),
    latencyMs: z.number(),
    reason: z.string().nullable(),
    at: z.number(),
  }),
  z.object({
    type: z.literal("DECISION_READY"),
    decision: AgentDecisionSchema,
    at: z.number(),
  }),
  z.object({
    type: z.literal("DECISION_REJECTED_STALE"),
    decisionId: z.string(),
    currentScreenVersion: z.number(),
    at: z.number(),
  }),
  z.object({
    type: z.literal("AGENT_SPEECH_STARTED"),
    decisionId: z.string(),
    at: z.number(),
  }),
  z.object({
    type: z.literal("AGENT_INTERRUPTED"),
    decisionId: z.string().nullable(),
    at: z.number(),
  }),
  z.object({
    type: z.literal("WORKFLOW_STEP_VERIFIED"),
    stepId: workflowStepId,
    at: z.number(),
  }),
  z.object({
    type: z.literal("WORKFLOW_DEVIATION"),
    expected: z.string(),
    observed: z.string(),
    at: z.number(),
  }),
]);
