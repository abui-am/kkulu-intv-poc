import type { AgentDecision } from "@/schemas/agent-decision";

export type ValidationResult =
  | { ok: true }
  | { ok: false; reason: "stale"; decisionId: string; currentScreenVersion: number };

export function validateDecision(
  decision: AgentDecision,
  semanticVersion: number,
): ValidationResult {
  if (decision.basedOnScreenVersion !== semanticVersion) {
    return {
      ok: false,
      reason: "stale",
      decisionId: decision.id,
      currentScreenVersion: semanticVersion,
    };
  }
  return { ok: true };
}
