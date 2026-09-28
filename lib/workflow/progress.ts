import { canonicalizePage } from "@/lib/workflow/pages";
import { githubWorkflow, workflowStepOrder } from "@/lib/workflow/github-workflow";
import type { PerceptionStatus, WorkflowStepId } from "@/lib/world/types";
import type { ScreenReview } from "@/lib/workflow/guide";

const STEP_BY_PAGE = Object.fromEntries(
  workflowStepOrder.map((step) => [githubWorkflow[step].expectedScreen, step]),
) as Record<string, WorkflowStepId>;

export type ProgressObservation =
  | { outcome: "advance"; observedStep: WorkflowStepId; skippedSteps: WorkflowStepId[] }
  | { outcome: "revisit"; observedStep: WorkflowStepId }
  | { outcome: "backtrack" | "pending" | "ambiguous" | "off_path" };

export function observeProgress(input: {
  currentStep: WorkflowStepId;
  completedSteps: WorkflowStepId[];
  skippedSteps: WorkflowStepId[];
  observedPage: string | null;
  perceptionStatus: PerceptionStatus;
  review?: ScreenReview;
}): ProgressObservation {
  if (input.perceptionStatus !== "clear") return { outcome: "ambiguous" };
  const page = canonicalizePage(input.observedPage);
  if (page === "GitHub Connected" && input.review !== "confirmed_connection") return { outcome: "pending" };
  if (page === "Loading") return { outcome: "pending" };
  if (page === "Dashboard") {
    return { outcome: input.currentStep === "openSettings" ? "pending" : "backtrack" };
  }
  const observedStep = page ? STEP_BY_PAGE[page] : undefined;
  if (!observedStep) return { outcome: "off_path" };
  if (input.completedSteps.includes(observedStep)) return { outcome: "backtrack" };
  const currentIndex = workflowStepOrder.indexOf(input.currentStep);
  const observedIndex = workflowStepOrder.indexOf(observedStep);
  if (observedIndex < currentIndex) {
    return input.skippedSteps.includes(observedStep)
      ? { outcome: "revisit", observedStep }
      : { outcome: "backtrack" };
  }
  return {
    outcome: "advance",
    observedStep,
    skippedSteps: workflowStepOrder.slice(currentIndex, observedIndex),
  };
}
