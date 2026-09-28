import { canonicalizePage } from "@/lib/workflow/pages";
import { awaitsConnection, stepOrder, type Workflow } from "@/lib/workflow/model";
import type { PerceptionStatus, WorkflowStepId } from "@/lib/world/types";
import type { ScreenReview } from "@/lib/workflow/guide";

export type ProgressObservation =
  | { outcome: "advance"; observedStep: WorkflowStepId; skippedSteps: WorkflowStepId[] }
  | { outcome: "revisit"; observedStep: WorkflowStepId }
  | { outcome: "backtrack" | "pending" | "ambiguous" | "off_path" };

export function observeProgress(workflow: Workflow, input: {
  currentStep: WorkflowStepId;
  completedSteps: WorkflowStepId[];
  skippedSteps: WorkflowStepId[];
  observedPage: string | null;
  perceptionStatus: PerceptionStatus;
  review?: ScreenReview;
}): ProgressObservation {
  if (input.perceptionStatus !== "clear") return { outcome: "ambiguous" };
  const page = canonicalizePage(input.observedPage);
  const order = stepOrder(workflow);
  if (awaitsConnection(workflow, page) && input.review !== "confirmed_connection") return { outcome: "pending" };
  if (page === "Loading") return { outcome: "pending" };
  const start = workflow.steps[0];
  const expectedByPage = new Map(workflow.steps.map((step) => [step.expectedPage, step.id]));
  if (start && page === start.page && !expectedByPage.has(page)) {
    return { outcome: input.currentStep === start.id ? "pending" : "backtrack" };
  }
  const observedStep = page ? expectedByPage.get(page) : undefined;
  if (!observedStep) return { outcome: "off_path" };
  if (input.completedSteps.includes(observedStep)) return { outcome: "backtrack" };
  const currentIndex = order.indexOf(input.currentStep);
  const observedIndex = order.indexOf(observedStep);
  if (observedIndex < currentIndex) {
    return input.skippedSteps.includes(observedStep)
      ? { outcome: "revisit", observedStep }
      : { outcome: "backtrack" };
  }
  return {
    outcome: "advance",
    observedStep,
    skippedSteps: order.slice(currentIndex, observedIndex),
  };
}
