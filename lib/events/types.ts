import type { AgentDecision } from "@/schemas/agent-decision";
import type { ScreenState } from "@/schemas/screen-state";
import type { WorkflowStepId } from "@/lib/world/types";
import type { ReflectionAssessment } from "@/lib/agent/reflection";
import type { ScreenReview } from "@/lib/workflow/guide";

export type SessionEvent =
  | {
      type: "SESSION_STARTED";
      at: number;
    }
  | {
      type: "USER_SPEECH_STARTED";
      at: number;
    }
  | {
      type: "USER_TRANSCRIPT_PARTIAL";
      text: string;
      itemId: string;
      at: number;
    }
  | {
      type: "USER_TRANSCRIPT_FINAL";
      text: string;
      itemId: string;
      at: number;
    }
  | {
      type: "FRAME_SAMPLED";
      frameVersion: number;
      changeRatio: number;
      at: number;
    }
  | {
      type: "SCREEN_CHANGE_CANDIDATE";
      at: number;
    }
  | {
      type: "SCREEN_STABILIZED";
      imageId: string;
      at: number;
    }
  | {
      type: "SCREEN_STATE_UPDATED";
      screen: ScreenState;
      semanticVersion: number;
      review?: ScreenReview;
      at: number;
    }
  | { type: "SCREEN_READ_FAILED"; at: number }
  | { type: "SANDBOX_INTERACTION"; label: string; at: number }
  | { type: "SANDBOX_PAGE_REPORTED"; page: string; at: number }
  | { type: "HOST_SURFACE"; name: string; state: "opened" | "closed"; at: number }
  | {
      type: "SCREEN_UNAVAILABLE";
      at: number;
    }
  | {
      type: "REASONING_STARTED";
      basedOnScreenVersion: number;
      at: number;
    }
  | {
      type: "DECISION_READY";
      decision: AgentDecision;
      at: number;
    }
  | {
      type: "DECISION_REJECTED_STALE";
      decisionId: string;
      currentScreenVersion: number;
      at: number;
    }
  | {
      type: "AGENT_SPEECH_STARTED";
      decisionId: string;
      at: number;
    }
  | {
      type: "AGENT_INTERRUPTED";
      decisionId: string | null;
      at: number;
    }
  | {
      type: "WORKFLOW_STEP_VERIFIED";
      stepId: WorkflowStepId;
      at: number;
    }
  | {
      type: "WORKFLOW_PROGRESS_RECONCILED";
      observedStep: WorkflowStepId;
      skippedSteps: WorkflowStepId[];
      at: number;
    }
  | { type: "WORKFLOW_ON_PATH"; at: number }
  | {
      type: "WORKFLOW_DEVIATION";
      expected: string;
      observed: string;
      at: number;
    }
  | {
      type: "TRANSITION_REFLECTED";
      reflection: ReflectionAssessment;
      at: number;
    };

export const EVENT_LOG_LIMIT = 100;
