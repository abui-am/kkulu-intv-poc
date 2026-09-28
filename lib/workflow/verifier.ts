import type { PerceptionStatus, WorkflowStepId } from "@/lib/world/types";
import { canonicalizePage } from "@/lib/workflow/pages";
import { stepById, type Workflow } from "@/lib/workflow/model";

export type VerifyResult =
  | { outcome: "match"; stepId: WorkflowStepId }
  | { outcome: "deviation"; expected: string; observed: string }
  | { outcome: "ambiguous"; reason: string }
  | { outcome: "pending"; reason: string };

export function verifyObservation(workflow: Workflow, input: {
  currentStep: WorkflowStepId;
  observedPage: string | null;
  perceptionStatus: PerceptionStatus;
}): VerifyResult {
  const step = stepById(workflow, input.currentStep);
  if (!step) {
    return { outcome: "ambiguous", reason: "The current step is not in the workflow." };
  }
  const expected = step.expectedPage;

  if (input.perceptionStatus === "unknown" || input.perceptionStatus === "ambiguous") {
    return {
      outcome: "ambiguous",
      reason: "Screen perception is not clear enough to advance the workflow.",
    };
  }

  const observed = canonicalizePage(input.observedPage);
  if (!observed) {
    return {
      outcome: "ambiguous",
      reason: "The observed page does not match a known screen.",
    };
  }

  if (observed === "Loading") {
    return {
      outcome: "pending",
      reason: "The screen is still loading.",
    };
  }

  if (observed === expected) {
    return { outcome: "match", stepId: input.currentStep };
  }

  if (observed === step.page) {
    return {
      outcome: "pending",
      reason: `Still on ${observed}. Waiting for ${expected}.`,
    };
  }

  return {
    outcome: "deviation",
    expected,
    observed,
  };
}
