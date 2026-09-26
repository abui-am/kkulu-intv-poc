import { z } from "zod";

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
  relevantElements: z.array(
    z.object({
      label: z.string(),
      role: z.string(),
      state: z.string().optional(),
    }),
  ),
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
        },
        required: ["label", "role", "state"],
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
