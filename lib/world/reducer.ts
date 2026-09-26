import type { SessionEvent } from "@/lib/events/types";
import { derivePerceptionStatus } from "@/lib/screen/perception";
import {
  githubWorkflow,
  isTerminalStep,
  nextStep,
} from "@/lib/workflow/github-workflow";
import type { WorldModel } from "@/lib/world/types";

function looksLikeQuestion(text: string): boolean {
  return text.includes("?") || /^(why|what|how|when|where|who|does|do|can|could)\b/i.test(text.trim());
}

export function reduceWorld(world: WorldModel, event: SessionEvent): WorldModel {
  switch (event.type) {
    case "SESSION_STARTED":
      return {
        ...world,
        agent: { ...world.agent, status: "listening", speechInterrupted: false },
      };
    case "USER_SPEECH_STARTED":
      return {
        ...world,
        agent: {
          ...world.agent,
          status: "listening",
          speechInterrupted:
            world.agent.speechInterrupted || world.agent.status === "speaking",
        },
      };
    case "USER_TRANSCRIPT_PARTIAL":
      return {
        ...world,
        conversation: { ...world.conversation, partialTranscript: event.text },
      };
    case "USER_TRANSCRIPT_FINAL":
      return {
        ...world,
        conversation: {
          partialTranscript: "",
          latestUserUtterance: event.text,
          activeQuestion: looksLikeQuestion(event.text) ? event.text : world.conversation.activeQuestion,
        },
      };
    case "FRAME_SAMPLED":
      return {
        ...world,
        screen: { ...world.screen, frameVersion: event.frameVersion },
      };
    case "SCREEN_CHANGE_CANDIDATE":
    case "SCREEN_STABILIZED":
      return world;
    case "SCREEN_STATE_UPDATED": {
      const perceptionStatus = derivePerceptionStatus(event.screen);
      return {
        ...world,
        screen: {
          ...world.screen,
          semanticVersion: event.semanticVersion,
          observedAt: event.at,
          page: event.screen.page,
          summary: event.screen.summary,
          relevantElements: event.screen.relevantElements,
          perceptionStatus,
          source: "vision",
        },
        flags: {
          ...world.flags,
          needsDeepReasoning: perceptionStatus === "ambiguous",
          screenAvailable: true,
        },
      };
    }
    case "SCREEN_UNAVAILABLE":
      return {
        ...world,
        screen: {
          ...world.screen,
          page: null,
          summary: null,
          relevantElements: [],
          perceptionStatus: "unknown",
          observedAt: event.at,
        },
        flags: { ...world.flags, screenAvailable: false },
      };
    case "REASONING_STARTED":
      return {
        ...world,
        agent: { ...world.agent, status: "thinking" },
      };
    case "DECISION_READY":
      return {
        ...world,
        agent: {
          ...world.agent,
          lastDecision: event.decision,
          lastInstruction: event.decision.response,
        },
        expectation: {
          expectedScreenState: event.decision.expectedScreenState || world.workflow.expectedNextState || null,
          createdFromScreenVersion: event.decision.basedOnScreenVersion,
        },
        conversation: {
          ...world.conversation,
          activeQuestion:
            event.decision.type === "answer" || event.decision.type === "clarify"
              ? null
              : world.conversation.activeQuestion,
        },
        flags: {
          ...world.flags,
          needsDeepReasoning: event.decision.requiresDeepReasoning,
        },
      };
    case "DECISION_REJECTED_STALE":
      return world;
    case "AGENT_SPEECH_STARTED":
      return {
        ...world,
        agent: { ...world.agent, status: "speaking", speechInterrupted: false },
      };
    case "AGENT_INTERRUPTED":
      return {
        ...world,
        agent: { ...world.agent, status: "listening", speechInterrupted: true },
      };
    case "WORKFLOW_STEP_VERIFIED": {
      const completed = world.workflow.completedSteps.includes(event.stepId)
        ? world.workflow.completedSteps
        : [...world.workflow.completedSteps, event.stepId];
      const terminal = isTerminalStep(event.stepId);
      const upcoming = nextStep(event.stepId);
      return {
        ...world,
        goal: {
          ...world.goal,
          status: terminal ? "completed" : world.goal.status,
        },
        workflow: {
          currentStep: upcoming ?? event.stepId,
          completedSteps: completed,
          expectedNextState: upcoming
            ? githubWorkflow[upcoming].expectedScreen
            : githubWorkflow[event.stepId].expectedScreen,
          recoveryAttempts: 0,
        },
        expectation: {
          expectedScreenState: upcoming
            ? githubWorkflow[upcoming].expectedScreen
            : githubWorkflow[event.stepId].expectedScreen,
          createdFromScreenVersion: world.screen.semanticVersion,
        },
        flags: { ...world.flags, conflictingEvidence: false, needsDeepReasoning: false },
      };
    }
    case "WORKFLOW_DEVIATION":
      return {
        ...world,
        workflow: {
          ...world.workflow,
          recoveryAttempts: world.workflow.recoveryAttempts + 1,
        },
        flags: { ...world.flags, conflictingEvidence: true, needsDeepReasoning: true },
      };
    default:
      return world;
  }
}
