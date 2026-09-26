import type { AgentDecision } from "@/schemas/agent-decision";
import type { PerceptionStatus } from "@/lib/world/types";

export function detectGoalChange(utterance: string | null): boolean {
  if (!utterance) return false;
  return /\b(forget github|stop connecting github|different goal|new goal|instead connect slack|switch (the )?goal)\b/i.test(
    utterance,
  );
}

export function needsDeepReasoning(input: {
  perceptionStatus: PerceptionStatus;
  conflictingEvidence: boolean;
  recoveryAttempts: number;
  userChangedGoal: boolean;
  decisionRequiresDeep?: boolean;
}): boolean {
  return (
    input.perceptionStatus === "ambiguous" ||
    input.conflictingEvidence ||
    input.recoveryAttempts >= 2 ||
    input.userChangedGoal ||
    input.decisionRequiresDeep === true
  );
}

export function routeModel(input: {
  perceptionStatus: PerceptionStatus;
  conflictingEvidence: boolean;
  recoveryAttempts: number;
  userChangedGoal: boolean;
  decision?: AgentDecision | null;
}): "fast" | "deep" {
  return needsDeepReasoning({
    perceptionStatus: input.perceptionStatus,
    conflictingEvidence: input.conflictingEvidence,
    recoveryAttempts: input.recoveryAttempts,
    userChangedGoal: input.userChangedGoal,
    decisionRequiresDeep: input.decision?.requiresDeepReasoning,
  })
    ? "deep"
    : "fast";
}
