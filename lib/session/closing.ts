import type { Guide } from "@/lib/workflow/guide";
import { workflowStepLabels } from "@/lib/workflow/github-workflow";
import type { WorkflowStepId } from "@/lib/world/types";

export type CardPhase = "welcome" | "live" | "done" | "paused" | "finished";

export type PrimaryAction = "start" | "stop" | "done" | "continue" | "again";

export function cardPhase(input: {
  running: boolean;
  ended: boolean;
  goalStatus: "active" | "completed" | "blocked";
  guideKind: Guide["kind"] | null;
}): CardPhase {
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
}): { heading: string | null; body: string; primary: PrimaryAction } {
  const task = workflowStepLabels[input.currentStep];
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
        heading: "GitHub is connected",
        body: input.instruction?.trim() || "You're all set. GitHub is connected.",
        primary: "done",
      };
    case "paused":
      return { heading: `Stopped at ${task}`, body: "Your place is saved.", primary: "continue" };
    case "finished":
      return { heading: "GitHub is connected", body: "That's the setup.", primary: "again" };
  }
}
