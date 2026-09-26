import type { ReasoningContext } from "@/lib/agent/context-builder";
import { detectGoalChange } from "@/lib/agent/router";
import { LOOKAHEAD_CANDIDATE_COUNT, type CandidateAction, type RolloutBranch } from "@/schemas/lookahead";

const QUESTION_START = /^(why|what|how|when|where|who|does|do|can|could|would|is|are|will)\b/i;

export function isLookaheadEligible(context: ReasoningContext, signals: {
  perceptionStatus: "unknown" | "clear" | "ambiguous";
  conflictingEvidence: boolean;
  userChangedGoal: boolean;
}): boolean {
  const utterance = context.latestUserUtterance?.trim() ?? "";
  const isQuestion = utterance.includes("?") || QUESTION_START.test(utterance);
  const isWaitingState = /\b(loading|wait|waiting|still loading)\b/i.test(
    [context.screen.page, context.screen.summary, context.activeQuestion].filter(Boolean).join(" "),
  );

  return Boolean(
    context.screen.available &&
      context.screen.perceptionStatus === "clear" &&
      signals.perceptionStatus === "clear" &&
      !signals.conflictingEvidence &&
      !signals.userChangedGoal &&
      !detectGoalChange(context.latestUserUtterance) &&
      !context.activeQuestion &&
      !isQuestion &&
      !isWaitingState,
  );
}

export function orderCandidates(candidates: CandidateAction[]): CandidateAction[] {
  if (candidates.length !== LOOKAHEAD_CANDIDATE_COUNT) {
    throw new Error(`Expected exactly ${LOOKAHEAD_CANDIDATE_COUNT} candidate actions`);
  }
  const ids = new Set(candidates.map((candidate) => candidate.id));
  if (ids.size !== candidates.length) throw new Error("Candidate action IDs must be unique");
  const instructions = new Set(candidates.map((candidate) => candidate.instruction.trim().toLowerCase()));
  if (instructions.size !== candidates.length || instructions.has("")) {
    throw new Error("Candidate instructions must be non-empty and meaningfully distinct");
  }
  return [...candidates].sort((left, right) => left.id.localeCompare(right.id));
}

export function buildPredictionTree(branches: RolloutBranch[]): string {
  if (branches.length === 0) return "No valid prediction branches.";
  return branches
    .map((branch, index) => {
      const elementText = (elements: RolloutBranch["predictedState"]["relevantElements"]) =>
        elements
          .map((element) => {
            const position = element.bbox ? ` @${element.bbox.join(",")}` : "";
            return `${element.label}${element.state ? ` (${element.state})` : ""}${position}`;
          })
          .join("; ") || "none";

      return [
        `Branch ${index + 1} (${branch.candidate.id})`,
        `First instruction: ${branch.candidate.instruction}`,
        `Predicted state 1: ${branch.predictedState.page} — ${branch.predictedState.summary}`,
        `Elements 1: ${elementText(branch.predictedState.relevantElements)}`,
        `Confidence 1: ${branch.predictedState.confidence}; goal progress: ${branch.predictedState.goalProgress}`,
        `Possible failure 1: ${branch.predictedState.possibleFailure || "none"}`,
        `Follow-up: ${branch.followUp.instruction}`,
        `Predicted state 2: ${branch.secondPredictedState.page} — ${branch.secondPredictedState.summary}`,
        `Elements 2: ${elementText(branch.secondPredictedState.relevantElements)}`,
        `Confidence 2: ${branch.secondPredictedState.confidence}; goal progress: ${branch.secondPredictedState.goalProgress}`,
        `Possible failure 2: ${branch.secondPredictedState.possibleFailure || "none"}`,
      ].join("\n");
    })
    .join("\n\n");
}
