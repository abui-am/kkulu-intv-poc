import type { ScreenElement } from "@/lib/world/types";
import type { WorldModel } from "@/lib/world/types";
import type { ReflectionAssessment } from "@/lib/agent/reflection";
import type { Guide } from "@/lib/workflow/guide";

export type ReasoningContext = {
  sessionObjective: string;
  workflow: {
    currentStep: string;
    completedSteps: string[];
    skippedSteps: string[];
    expectedNextState?: string;
  };
  latestUserUtterance: string | null;
  screen: {
    version: number;
    page: string | null;
    summary: string | null;
    relevantElements: ScreenElement[];
    perceptionStatus: "unknown" | "clear" | "ambiguous";
    available: boolean;
    previousPage: string | null;
  };
  recentRelevantConversation: string[];
  lastInstruction: string | null;
  activeQuestion: string | null;
  discrepancy?: {
    expected: string;
    observed: string;
  };
  reflection: ReflectionAssessment | null;
  guide: Guide | null;
};

const CONVERSATION_LIMIT = 4;

export function buildReasoningContext(
  world: WorldModel,
  recentTurns: string[],
  discrepancy?: { expected: string; observed: string },
  previousPage?: string | null,
): ReasoningContext {
  return {
    sessionObjective: world.goal.description,
    workflow: {
      currentStep: world.workflow.currentStep,
      completedSteps: world.workflow.completedSteps,
      skippedSteps: world.workflow.skippedSteps,
      expectedNextState: world.workflow.expectedNextState,
    },
    latestUserUtterance: world.conversation.latestUserUtterance,
    screen: {
      version: world.screen.semanticVersion,
      page: world.screen.page,
      summary: world.screen.summary,
      relevantElements: world.screen.relevantElements,
      perceptionStatus: world.screen.perceptionStatus,
      available: world.flags.screenAvailable,
      previousPage: previousPage ?? null,
    },
    recentRelevantConversation: recentTurns.slice(-CONVERSATION_LIMIT),
    lastInstruction: world.agent.lastInstruction,
    activeQuestion: world.conversation.activeQuestion,
    discrepancy,
    reflection: world.reflection,
    guide: world.agent.activeGuide,
  };
}
