import type { WorldModel } from "@/lib/world/types";

export function createInitialWorldModel(sessionId: string): WorldModel {
  return {
    sessionId,
    goal: {
      id: "connect_github",
      description: "Connect GitHub to the SaaS application.",
      status: "active",
    },
    workflow: {
      currentStep: "openSettings",
      completedSteps: [],
      skippedSteps: [],
      expectedNextState: "Settings",
      recoveryAttempts: 0,
    },
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
      expectedScreenState: "Settings",
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
