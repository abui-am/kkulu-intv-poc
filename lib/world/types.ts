import type { AgentDecision } from "@/schemas/agent-decision";

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
    speechInterrupted: boolean;
  };

  expectation: {
    expectedScreenState: ScreenSemanticState | null;
    createdFromScreenVersion: number | null;
  };

  flags: {
    conflictingEvidence: boolean;
    needsDeepReasoning: boolean;
    screenAvailable: boolean;
  };
};
