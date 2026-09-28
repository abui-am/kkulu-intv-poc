import { connectGithub } from "@/lib/workflow/connect-github";
import type { Guide } from "@/lib/workflow/guide";
import { stepLabel } from "@/lib/workflow/model";
import type { WorkflowStepId } from "@/lib/world/types";

export type CardPhase = "welcome" | "live" | "done" | "paused" | "finished" | "escalated";

export type PrimaryAction = "start" | "stop" | "done" | "continue" | "again";

export function cardPhase(input: {
  running: boolean;
  ended: boolean;
  goalStatus: "active" | "completed" | "blocked";
  guideKind: Guide["kind"] | null;
}): CardPhase {
  if (input.goalStatus === "blocked" || input.guideKind === "escalate") return "escalated";
  const finished = input.goalStatus === "completed" || input.guideKind === "complete";
  if (input.running && finished) return "done";
  if (input.running) return "live";
  if (input.ended && finished) return "finished";
  if (input.ended) return "paused";
  return "welcome";
}

export function cardCopy(input: {
  phase: CardPhase;
  currentStep: WorkflowStepId;
  instruction: string | null;
  stepLabel?: string;
  successLabel?: string;
  handoff?: string | null;
}): { heading: string | null; body: string; primary: PrimaryAction } {
  const task = input.stepLabel ?? stepLabel(connectGithub, input.currentStep);
  const success = input.successLabel ?? connectGithub.successLabel;
  switch (input.phase) {
    case "welcome":
      return {
        heading: null,
        body: "Start the session and I'll walk you through it.",
        primary: "start",
      };
    case "live":
      return { heading: task, body: input.instruction?.trim() || task, primary: "stop" };
    case "done":
      return {
        heading: success,
        body: input.instruction?.trim() || `You're all set. ${success}.`,
        primary: "done",
      };
    case "paused":
      return { heading: `Stopped at ${task}`, body: "Your place is saved.", primary: "continue" };
    case "finished":
      return { heading: success, body: "That's the setup.", primary: "again" };
    case "escalated":
      return {
        heading: "Flagged for the team",
        body: input.handoff?.trim() || input.instruction?.trim() || "This needs a person. The screen and the step are saved.",
        primary: "done",
      };
  }
}
