import type { AgentDecision } from "@/schemas/agent-decision";
import type { ScreenState } from "@/schemas/screen-state";
import type { WorkflowStepId } from "@/lib/world/types";

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
      at: number;
    }
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
      type: "LOOKAHEAD_STARTED";
      basedOnScreenVersion: number;
      at: number;
    }
  | {
      type: "LOOKAHEAD_RESULT";
      basedOnScreenVersion: number;
      status: "completed" | "bypassed" | "fallback";
      candidateCount: number;
      validBranchCount: number;
      modelCalls: number;
      latencyMs: number;
      reason: string | null;
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
      type: "WORKFLOW_DEVIATION";
      expected: string;
      observed: string;
      at: number;
    };

export const EVENT_LOG_LIMIT = 100;
