import { z } from "zod";

export const TransitionStateSchema = z.object({
  page: z.string().nullable(),
  summary: z.string().nullable(),
});

export const TransitionRecordSchema = z.object({
  subgoal: z.string(),
  action: z.string(),
  before: TransitionStateSchema,
  after: TransitionStateSchema,
  expectedPage: z.string(),
  consistent: z.boolean(),
});

export const ReflectionInputSchema = z.object({
  subgoal: z.string().min(1),
  action: z.string().min(1),
  target: z.string().nullable(),
  precondition: z.string().min(1),
  postcondition: z.string().min(1),
  expectedPage: z.string().min(1),
  before: TransitionStateSchema,
  after: TransitionStateSchema,
  history: z.array(TransitionRecordSchema).max(5),
});

export const ReflectionResultSchema = z.object({
  consistent: z.boolean(),
  beforeDescription: z.string(),
  afterDescription: z.string(),
  observedChange: z.string(),
  alignment: z.string(),
});

export type TransitionState = z.infer<typeof TransitionStateSchema>;
export type TransitionRecord = z.infer<typeof TransitionRecordSchema>;
export type ReflectionInput = z.infer<typeof ReflectionInputSchema>;
export type ReflectionResult = z.infer<typeof ReflectionResultSchema>;

export const reflectionResultJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    consistent: { type: "boolean" },
    beforeDescription: { type: "string" },
    afterDescription: { type: "string" },
    observedChange: { type: "string" },
    alignment: { type: "string" },
  },
  required: ["consistent", "beforeDescription", "afterDescription", "observedChange", "alignment"],
} as const;
