import type { AgentDecision } from "@/schemas/agent-decision";
import type { ReflectionInput, ReflectionResult, TransitionRecord, TransitionState } from "@/schemas/reflection";
import type { WorldModel } from "@/lib/world/types";

export type PendingTransition = {
  decisionId: string;
  basedOnScreenVersion: number;
  beforeImage: string;
  specification: Omit<ReflectionInput, "after" | "history">;
};

export type ReflectionAssessment = {
  decisionId: string;
  subgoal: string;
  expectedPage: string;
  observedPage: string | null;
  status: "consistent" | "mismatch" | "unavailable";
  result: ReflectionResult | null;
};

export function createPendingTransition(
  decision: AgentDecision,
  world: WorldModel,
  beforeImage: string | null,
): PendingTransition | null {
  if (!beforeImage || (decision.type !== "guide" && decision.type !== "recover")) return null;
  const guide = world.agent.activeGuide;
  const expectedPage = guide?.kind === "action"
    ? guide.expectedPage
    : decision.expectedScreenState?.trim() || world.workflow.expectedNextState;
  if (!expectedPage) return null;
  return {
    decisionId: decision.id,
    basedOnScreenVersion: decision.basedOnScreenVersion,
    beforeImage,
    specification: {
      subgoal: guide?.kind === "action" && guide.stepId ? guide.stepId : world.workflow.currentStep,
      action: decision.response,
      target: decision.target?.trim() || null,
      precondition: decision.target?.trim()
        ? `${decision.target.trim()} is available on the before screen`
        : `${world.screen.page ?? "Current screen"} is visible`,
      postcondition: `${expectedPage} is visible`,
      expectedPage,
      before: { page: world.screen.page, summary: world.screen.summary },
    },
  };
}

export function recentSubgoalHistory(history: TransitionRecord[], subgoal: string): TransitionRecord[] {
  const recent: TransitionRecord[] = [];
  for (let index = history.length - 1; index >= 0 && recent.length < 5; index -= 1) {
    if (history[index].subgoal !== subgoal) break;
    recent.push(history[index]);
  }
  return recent.reverse();
}

export function buildReflectionInput(
  pending: PendingTransition,
  after: TransitionState,
  history: TransitionRecord[],
): ReflectionInput {
  return {
    ...pending.specification,
    after,
    history: recentSubgoalHistory(history, pending.specification.subgoal),
  };
}
