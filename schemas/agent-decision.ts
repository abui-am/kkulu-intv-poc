import { z } from "zod";

export const AgentDecisionSchema = z.object({
  id: z.string(),
  type: z.enum([
    "guide",
    "answer",
    "clarify",
    "recover",
    "wait",
    "complete",
    "escalate",
  ]),
  basedOnScreenVersion: z.number(),
  target: z.string().optional(),
  expectedScreenState: z.string().optional(),
  response: z.string(),
  reasoningClass: z.enum([
    "normal_flow",
    "question",
    "deviation",
    "ambiguity",
    "stale_state_recovery",
  ]),
  requiresDeepReasoning: z.boolean(),
});

export type AgentDecision = z.infer<typeof AgentDecisionSchema>;

export const agentDecisionJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    id: { type: "string" },
    type: {
      type: "string",
      enum: ["guide", "answer", "clarify", "recover", "wait", "complete", "escalate"],
    },
    basedOnScreenVersion: { type: "number" },
    target: { type: "string" },
    expectedScreenState: { type: "string" },
    response: { type: "string" },
    reasoningClass: {
      type: "string",
      enum: [
        "normal_flow",
        "question",
        "deviation",
        "ambiguity",
        "stale_state_recovery",
      ],
    },
    requiresDeepReasoning: { type: "boolean" },
  },
  required: [
    "id",
    "type",
    "basedOnScreenVersion",
    "target",
    "expectedScreenState",
    "response",
    "reasoningClass",
    "requiresDeepReasoning",
  ],
} as const;
