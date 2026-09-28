import { connectGithub } from "@/lib/workflow/connect-github";
import type { Workflow } from "@/lib/workflow/model";
import type { WorldModel } from "@/lib/world/types";

export function createInitialWorldModel(sessionId: string, workflow: Workflow = connectGithub): WorldModel {
  const first = workflow.steps[0];
  return {
    sessionId,
    goal: {
      id: workflow.id,
      description: workflow.goal,
      status: "active",
    },
    workflow: {
      definition: workflow,
      currentStep: first?.id ?? "openSettings",
      completedSteps: [],
      skippedSteps: [],
      expectedNextState: first?.expectedPage ?? "Settings",
      recoveryAttempts: 0,
    },
    escalation: null,
    screen: {
      frameVersion: 0,
      semanticVersion: 0,
      observedAt: null,
      page: null,
      summary: null,
      relevantElements: [],
      perceptionStatus: "unknown",
      review: "normal",
      source: "vision",
    },
    conversation: {
      partialTranscript: "",
      latestUserUtterance: null,
      activeQuestion: null,
    },
    agent: {
      status: "idle",
      lastDecision: null,
      lastInstruction: null,
      activeGuide: null,
      speechInterrupted: false,
    },
    expectation: {
      expectedScreenState: first?.expectedPage ?? "Settings",
      createdFromScreenVersion: null,
    },
    reflection: null,
    flags: {
      conflictingEvidence: false,
      needsDeepReasoning: false,
      screenAvailable: false,
    },
  };
}
