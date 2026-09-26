import { z } from "zod";

export const ScreenElementSchema = z.object({
  label: z.string(),
  role: z.string(),
  state: z.string().optional(),
  // Older saved traces do not have coordinates, so keep this optional on read.
  bbox: z.tuple([
    z.number().min(0).max(1000),
    z.number().min(0).max(1000),
    z.number().min(0).max(1000),
    z.number().min(0).max(1000),
  ]).optional(),
});

export const ScreenStateSchema = z.object({
  page: z.string(),
  summary: z.string(),
  semanticChange: z.boolean(),
  changeType: z.enum([
    "none",
    "navigation",
    "modal",
    "form_update",
    "success",
    "error",
    "unknown",
  ]),
  relevantElements: z.array(ScreenElementSchema),
  delta: z.string(),
  ambiguity: z
    .object({
      ambiguous: z.boolean(),
      reason: z.string().optional(),
    })
    .optional(),
});

export type ScreenState = z.infer<typeof ScreenStateSchema>;

export const screenStateJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    page: { type: "string" },
    summary: { type: "string" },
    semanticChange: { type: "boolean" },
    changeType: {
      type: "string",
      enum: [
        "none",
        "navigation",
        "modal",
        "form_update",
        "success",
        "error",
        "unknown",
      ],
    },
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
            description: "Approximate normalized [left, top, right, bottom] coordinates on a 0-1000 grid.",
          },
        },
        required: ["label", "role", "state", "bbox"],
      },
    },
    delta: { type: "string" },
    ambiguity: {
      type: "object",
      additionalProperties: false,
      properties: {
        ambiguous: { type: "boolean" },
        reason: { type: "string" },
      },
      required: ["ambiguous", "reason"],
    },
  },
  required: [
    "page",
    "summary",
    "semanticChange",
    "changeType",
    "relevantElements",
    "delta",
    "ambiguity",
  ],
} as const;
