import { z } from "zod";
import { ScreenElementSchema } from "@/schemas/screen-state";

export const LOOKAHEAD_CANDIDATE_COUNT = 3;

export const CandidateActionSchema = z.object({
  id: z.string(),
  type: z.enum(["guide", "recover", "wait"]),
  instruction: z.string(),
  target: z.string(),
  expectedScreenState: z.string(),
});

export type CandidateAction = z.infer<typeof CandidateActionSchema>;

export const CandidateSetSchema = z.object({
  candidates: z.array(CandidateActionSchema).length(LOOKAHEAD_CANDIDATE_COUNT),
});

export const PredictedScreenSchema = z.object({
  page: z.string(),
  summary: z.string(),
  relevantElements: z.array(ScreenElementSchema),
  confidence: z.number().min(0).max(1),
  goalProgress: z.enum(["advances", "unchanged", "regresses", "uncertain"]),
  possibleFailure: z.string(),
});

export type PredictedScreen = z.infer<typeof PredictedScreenSchema>;

export const PredictionBatchSchema = z.object({
  predictions: z.array(
    z.object({ candidateId: z.string(), state: PredictedScreenSchema }),
  ).length(LOOKAHEAD_CANDIDATE_COUNT),
});

export const FollowUpBatchSchema = z.object({
  followUps: z.array(
    z.object({ candidateId: z.string(), action: CandidateActionSchema }),
  ).length(LOOKAHEAD_CANDIDATE_COUNT),
});

export const RolloutBranchSchema = z.object({
  candidate: CandidateActionSchema,
  predictedState: PredictedScreenSchema,
  followUp: CandidateActionSchema,
  secondPredictedState: PredictedScreenSchema,
  valid: z.boolean(),
  invalidReason: z.string().nullable(),
});

export type RolloutBranch = z.infer<typeof RolloutBranchSchema>;

export const RolloutSelectionSchema = z.object({
  candidateId: z.string(),
  rationale: z.string(),
});

export const RolloutSchema = z.object({
  basedOnScreenVersion: z.number(),
  candidateCount: z.number().int().nonnegative(),
  branches: z.array(RolloutBranchSchema),
  selectedCandidateId: z.string().nullable(),
  selectionRationale: z.string().nullable(),
  modelCalls: z.number().int().nonnegative(),
  latencyMs: z.number().nonnegative(),
  status: z.enum(["completed", "bypassed", "fallback"]),
  fallbackReason: z.string().nullable(),
});

export type Rollout = z.infer<typeof RolloutSchema>;

export const CandidateSetJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    candidates: {
      type: "array",
      minItems: LOOKAHEAD_CANDIDATE_COUNT,
      maxItems: LOOKAHEAD_CANDIDATE_COUNT,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          type: { type: "string", enum: ["guide", "recover", "wait"] },
          instruction: { type: "string" },
          target: { type: "string" },
          expectedScreenState: { type: "string" },
        },
        required: ["id", "type", "instruction", "target", "expectedScreenState"],
      },
    },
  },
  required: ["candidates"],
} as const;

const predictedScreenJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    page: { type: "string" },
    summary: { type: "string" },
    relevantElements: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          label: { type: "string" },
          role: { type: "string" },
          state: { type: "string" },
          bbox: {
            type: "array",
            items: { type: "number", minimum: 0, maximum: 1000 },
            minItems: 4,
            maxItems: 4,
          },
        },
        required: ["label", "role", "state", "bbox"],
      },
    },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    goalProgress: { type: "string", enum: ["advances", "unchanged", "regresses", "uncertain"] },
    possibleFailure: { type: "string" },
  },
  required: ["page", "summary", "relevantElements", "confidence", "goalProgress", "possibleFailure"],
} as const;

export const PredictionBatchJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    predictions: {
      type: "array",
      minItems: LOOKAHEAD_CANDIDATE_COUNT,
      maxItems: LOOKAHEAD_CANDIDATE_COUNT,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          candidateId: { type: "string" },
          state: predictedScreenJsonSchema,
        },
        required: ["candidateId", "state"],
      },
    },
  },
  required: ["predictions"],
} as const;

export const FollowUpBatchJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    followUps: {
      type: "array",
      minItems: LOOKAHEAD_CANDIDATE_COUNT,
      maxItems: LOOKAHEAD_CANDIDATE_COUNT,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          candidateId: { type: "string" },
          action: CandidateSetJsonSchema.properties.candidates.items,
        },
        required: ["candidateId", "action"],
      },
    },
  },
  required: ["followUps"],
} as const;

export const RolloutSelectionJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    candidateId: { type: "string" },
    rationale: { type: "string" },
  },
  required: ["candidateId", "rationale"],
} as const;
