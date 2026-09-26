import { describe, expect, it } from "vitest";
import { validateDecision } from "@/lib/agent/validator";
import type { AgentDecision } from "@/schemas/agent-decision";

function decision(version: number): AgentDecision {
  return {
    id: "d1",
    type: "guide",
    basedOnScreenVersion: version,
    response: "Open Integrations.",
    reasoningClass: "normal_flow",
    requiresDeepReasoning: false,
  };
}

describe("decision validator", () => {
  it("rejects a decision from an older semantic screen version", () => {
    expect(validateDecision(decision(4), 5)).toEqual({
      ok: false,
      reason: "stale",
      decisionId: "d1",
      currentScreenVersion: 5,
    });
  });

  it("allows a decision that matches the current semantic screen version", () => {
    expect(validateDecision(decision(5), 5)).toEqual({ ok: true });
  });
});
