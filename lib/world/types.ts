import type { AgentDecision } from "@/schemas/agent-decision";
import type { ReflectionAssessment } from "@/lib/agent/reflection";
import type { Guide, ScreenReview } from "@/lib/workflow/guide";

export type WorkflowStepId =
  | "openSettings"
  | "openIntegrations"
  | "selectGithub"
  | "authorizeGithub"
  | "verifyConnection";

export type ScreenElement = {
  label: string;
  role: string;
  state?: string;
  bbox?: [number, number, number, number];
};

export type ScreenSemanticState = string;

export type PerceptionStatus = "unknown" | "clear" | "ambiguous";

export type AgentStatus = "idle" | "listening" | "thinking" | "speaking";

export type WorldModel = {
  sessionId: string;

  goal: {
    id: "connect_github";
    description: string;
    status: "active" | "completed" | "blocked";
  };

  workflow: {
    currentStep: WorkflowStepId;
    completedSteps: WorkflowStepId[];
    skippedSteps: WorkflowStepId[];
    expectedNextState?: ScreenSemanticState;
    recoveryAttempts: number;
  };

  screen: {
    frameVersion: number;
    semanticVersion: number;
    observedAt: number | null;
    page: string | null;
    summary: string | null;
    relevantElements: ScreenElement[];
    perceptionStatus: PerceptionStatus;
    review: ScreenReview;
    source: "vision";
  };

  conversation: {
    partialTranscript: string;
    latestUserUtterance: string | null;
    activeQuestion: string | null;
  };

  agent: {
    status: AgentStatus;
    lastDecision: AgentDecision | null;
    lastInstruction: string | null;
    activeGuide: Guide | null;
    speechInterrupted: boolean;
  };

  expectation: {
    expectedScreenState: ScreenSemanticState | null;
    createdFromScreenVersion: number | null;
  };

  reflection: ReflectionAssessment | null;

  flags: {
    conflictingEvidence: boolean;
    needsDeepReasoning: boolean;
    screenAvailable: boolean;
  };
};
