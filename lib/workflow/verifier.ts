import type { PerceptionStatus, WorkflowStepId } from "@/lib/world/types";
import { canonicalizePage } from "@/lib/workflow/pages";
import {
  githubWorkflow,
  previousExpectedScreen,
} from "@/lib/workflow/github-workflow";

export type VerifyResult =
  | { outcome: "match"; stepId: WorkflowStepId }
  | { outcome: "deviation"; expected: string; observed: string }
  | { outcome: "ambiguous"; reason: string }
  | { outcome: "pending"; reason: string };

export function verifyObservation(input: {
  currentStep: WorkflowStepId;
  observedPage: string | null;
  perceptionStatus: PerceptionStatus;
}): VerifyResult {
  const expected = githubWorkflow[input.currentStep].expectedScreen;

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

  const previous = previousExpectedScreen(input.currentStep);
  if (previous && observed === previous) {
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
