import type { Guide } from "@/lib/workflow/guide";
import { stepLabel } from "@/lib/workflow/model";
import type { SessionSnapshot } from "@/lib/session/runtime";
import type { AgentStatus, WorkflowStepId } from "@/lib/world/types";

export const SESSION_CHANNEL = "kulu-agent-session";
export const DEBUG_CHANNEL = "kulu-agent-debug";

export type DebugChannelMessage =
  | { type: "request" }
  | { type: "snapshot"; snapshot: SessionSnapshot }
  | { type: "export"; includeScreenshots: boolean };

export type MirroredSession = {
  active: boolean;
  ended: boolean;
  status: AgentStatus;
  hearing: boolean;
  screenSharing: boolean;
  guide: Guide | null;
  currentStep: WorkflowStepId;
  stepLabel: string;
  successLabel: string;
  handoff: string | null;
  goalStatus: "active" | "completed" | "blocked";
  verifiedCount: number;
  skippedCount: number;
  instruction: string | null;
};

export type SessionChannelMessage =
  | { type: "request" }
  | { type: "snapshot"; session: MirroredSession }
  | { type: "interaction"; sourceId: string; label: string; at: number }
  | { type: "sandbox_page"; sourceId: string; page: string; at: number };

export function mirrorSession(snapshot: SessionSnapshot): MirroredSession {
  return {
    active: snapshot.world.agent.status !== "idle" && !snapshot.ended,
    ended: snapshot.ended,
    status: snapshot.ended ? "idle" : snapshot.world.agent.status,
    hearing: snapshot.hearing,
    screenSharing: snapshot.screenSharing,
    guide: snapshot.world.agent.activeGuide,
    currentStep: snapshot.world.workflow.currentStep,
    stepLabel: stepLabel(snapshot.world.workflow.definition, snapshot.world.workflow.currentStep),
    successLabel: snapshot.world.workflow.definition.successLabel,
    handoff: snapshot.world.escalation?.summary ?? null,
    goalStatus: snapshot.world.goal.status,
    verifiedCount: snapshot.world.workflow.completedSteps.length,
    skippedCount: snapshot.world.workflow.skippedSteps.length,
    instruction: snapshot.world.agent.lastInstruction,
  };
}
