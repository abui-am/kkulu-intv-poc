import type { AgentDecision } from "@/schemas/agent-decision";
import type { ReflectionAssessment } from "@/lib/agent/reflection";
import type { Guide, ScreenReview } from "@/lib/workflow/guide";
import type { Escalation, Workflow } from "@/lib/workflow/model";

export type WorkflowStepId = string;

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
    id: string;
    description: string;
    status: "active" | "completed" | "blocked";
  };

  workflow: {
    definition: Workflow;
    currentStep: WorkflowStepId;
    completedSteps: WorkflowStepId[];
    skippedSteps: WorkflowStepId[];
    expectedNextState?: ScreenSemanticState;
    recoveryAttempts: number;
  };

  escalation: Escalation | null;

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
