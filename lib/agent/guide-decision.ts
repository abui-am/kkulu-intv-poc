import type { Guide } from "@/lib/workflow/guide";
import type { AgentDecision } from "@/schemas/agent-decision";

function guideType(guide: Guide): AgentDecision["type"] {
  switch (guide.kind) {
    case "action": return "guide";
    case "wait": return "wait";
    case "clarify": return "clarify";
    case "reconnect": return "recover";
    case "complete": return "complete";
    case "escalate": return "escalate";
  }
}

export function guidedDecision(decision: AgentDecision, guide: Guide | null, activeQuestion: string | null): AgentDecision {
  if (guide?.kind === "escalate") {
    return {
      ...decision,
      type: "escalate",
      target: "",
      expectedScreenState: "",
      response: guide.instruction,
      reasoningClass: "deviation",
      requiresDeepReasoning: false,
    };
  }
  if (!guide) return decision;
  if (activeQuestion && guide.kind !== "reconnect") {
    const answer = decision.response.trim().replace(/[.!?]+$/, "");
    const guideText = guide.instruction.trim().replace(/[.!?]+$/, "");
    const alreadyGuided = answer.toLowerCase().endsWith(guideText.toLowerCase());
    return {
      ...decision,
      type: "answer",
      target: guide.kind === "action" ? guide.target : "",
      expectedScreenState: guide.kind === "action" ? guide.expectedPage : "",
      response: answer ? alreadyGuided ? `${answer}.` : `${answer}. ${guide.instruction}` : guide.instruction,
      reasoningClass: "question",
      requiresDeepReasoning: false,
    };
  }
  return {
    ...decision,
    type: guideType(guide),
    target: guide.kind === "action" ? guide.target : "",
    expectedScreenState: guide.kind === "action" ? guide.expectedPage : "",
    response: guide.instruction,
    reasoningClass: guide.kind === "reconnect" ? "stale_state_recovery" :
      guide.kind === "clarify" ? "ambiguity" : "normal_flow",
    requiresDeepReasoning: false,
  };
}

export function fallbackGuideDecision(guide: Guide, screenVersion: number): AgentDecision {
  return guidedDecision({
    id: crypto.randomUUID(),
    type: "wait",
    basedOnScreenVersion: screenVersion,
    target: "",
    expectedScreenState: "",
    response: "",
    reasoningClass: "normal_flow",
    requiresDeepReasoning: false,
  }, guide, null);
}
