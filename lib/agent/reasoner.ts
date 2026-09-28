import type { ReasoningContext } from "@/lib/agent/context-builder";
import { AgentDecisionSchema, type AgentDecision } from "@/schemas/agent-decision";

export async function requestDecision(input: {
  context: ReasoningContext;
  signals: {
    perceptionStatus: ReasoningContext["screen"]["perceptionStatus"];
    conflictingEvidence: boolean;
    recoveryAttempts: number;
    userChangedGoal: boolean;
  };
  signal?: AbortSignal;
}): Promise<{ decision: AgentDecision; model: "fast" | "deep" }> {
  const { signal, ...body } = input;
  const response = await fetch("/api/openai/reason", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  const payload: unknown = await response.json();
  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload
        ? String(payload.error)
        : "Reasoning failed";
    throw new Error(message);
  }
  const record = payload as { decision: unknown; model: "fast" | "deep" };
  return {
    decision: AgentDecisionSchema.parse(record.decision),
    model: record.model,
  };
}
