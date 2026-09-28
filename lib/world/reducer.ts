import type { SessionEvent } from "@/lib/events/types";
import { derivePerceptionStatus } from "@/lib/screen/perception";
import { guideForObservation, outsideWindowInstruction } from "@/lib/workflow/guide";
import { canonicalizePage } from "@/lib/workflow/pages";
import {
  githubWorkflow,
  isTerminalStep,
  nextStep,
  workflowStepOrder,
} from "@/lib/workflow/github-workflow";
import type { WorldModel } from "@/lib/world/types";

function looksLikeQuestion(text: string): boolean {
  return text.includes("?") || /^(why|what|how|when|where|who|does|do|can|could|explain|tell me|help me understand)\b/i.test(text.trim());
}

export function reduceWorld(world: WorldModel, event: SessionEvent): WorldModel {
  switch (event.type) {
    case "SESSION_STARTED":
      return {
        ...world,
        agent: {
          ...world.agent,
          status: "listening",
          speechInterrupted: false,
          activeGuide: world.agent.activeGuide?.kind === "action" || world.agent.activeGuide?.kind === "complete"
            ? world.agent.activeGuide
            : { kind: "wait", instruction: "Give me a second. I'm looking at the page." },
        },
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
          activeQuestion: looksLikeQuestion(event.text) ? event.text : null,
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
          review: event.review ?? "normal",
          source: "vision",
        },
        agent: {
          ...world.agent,
          activeGuide: guideForObservation({
            page: event.screen.page,
            perceptionStatus,
            screenAvailable: true,
            review: event.review,
          }),
        },
        flags: {
          ...world.flags,
          needsDeepReasoning: perceptionStatus === "ambiguous",
          screenAvailable: true,
        },
      };
    }
    case "SCREEN_READ_FAILED":
      return {
        ...world,
        screen: { ...world.screen, page: null, summary: null, relevantElements: [], perceptionStatus: "ambiguous", review: "normal" },
        agent: { ...world.agent, activeGuide: { kind: "clarify", instruction: "I lost my read on this screen. Keep the sandbox in view." } },
        flags: { ...world.flags, needsDeepReasoning: true },
      };
    case "SANDBOX_INTERACTION":
      return world;
    case "HOST_SURFACE": {
      if (event.state === "closed") return world;
      return {
        ...world,
        flags: { ...world.flags, screenAvailable: true },
        agent: {
          ...world.agent,
          activeGuide: { kind: "clarify", instruction: outsideWindowInstruction(event.name) },
        },
      };
    }
    case "SANDBOX_PAGE_REPORTED": {
      const page = canonicalizePage(event.page);
      if (page !== "Loading") return world;
      return {
        ...world,
        screen: {
          ...world.screen,
          page,
          summary: "Integrations is loading",
          perceptionStatus: "clear",
          review: "normal",
          observedAt: event.at,
        },
        flags: { ...world.flags, screenAvailable: true },
        agent: {
          ...world.agent,
          activeGuide: guideForObservation({ page, perceptionStatus: "clear", screenAvailable: true }),
        },
      };
    }
    case "SCREEN_UNAVAILABLE":
      return {
        ...world,
        conversation: { ...world.conversation, activeQuestion: null, partialTranscript: "" },
        screen: {
          ...world.screen,
          page: null,
          summary: null,
          relevantElements: [],
          perceptionStatus: "unknown",
          review: "normal",
          observedAt: event.at,
        },
        flags: { ...world.flags, screenAvailable: false },
        agent: {
          ...world.agent,
          activeGuide: guideForObservation({ page: null, perceptionStatus: "unknown", screenAvailable: false }),
        },
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
    case "TRANSITION_REFLECTED":
      return { ...world, reflection: event.reflection };
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
          skippedSteps: world.workflow.skippedSteps.filter((step) => step !== event.stepId),
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
    case "WORKFLOW_PROGRESS_RECONCILED": {
      const completedSteps = workflowStepOrder.filter(
        (step) => step === event.observedStep || world.workflow.completedSteps.includes(step),
      );
      const skippedSteps = workflowStepOrder.filter(
        (step) => !completedSteps.includes(step) &&
          (world.workflow.skippedSteps.includes(step) || event.skippedSteps.includes(step)),
      );
      const currentIndex = workflowStepOrder.indexOf(world.workflow.currentStep);
      const observedIndex = workflowStepOrder.indexOf(event.observedStep);
      const upcoming = nextStep(event.observedStep);
      const terminal = isTerminalStep(event.observedStep);
      const currentStep = terminal
        ? event.observedStep
        : observedIndex >= currentIndex && upcoming
          ? upcoming
          : world.workflow.currentStep;
      return {
        ...world,
        goal: { ...world.goal, status: terminal ? "completed" : world.goal.status },
        workflow: {
          ...world.workflow,
          currentStep,
          completedSteps,
          skippedSteps,
          expectedNextState: githubWorkflow[currentStep].expectedScreen,
          recoveryAttempts: 0,
        },
        expectation: {
          expectedScreenState: githubWorkflow[currentStep].expectedScreen,
          createdFromScreenVersion: world.screen.semanticVersion,
        },
        flags: { ...world.flags, conflictingEvidence: false, needsDeepReasoning: false },
      };
    }
    case "WORKFLOW_ON_PATH":
      return {
        ...world,
        workflow: { ...world.workflow, recoveryAttempts: 0 },
        flags: { ...world.flags, conflictingEvidence: false, needsDeepReasoning: false },
      };
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
