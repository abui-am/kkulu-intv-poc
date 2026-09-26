import { describe, expect, it } from "vitest";
import { buildReasoningContext } from "@/lib/agent/context-builder";
import { createInitialWorldModel } from "@/lib/world/initial-state";

describe("context builder", () => {
  it("projects a bounded context and leaves the event log out", () => {
    const world = createInitialWorldModel("s1");
    world.screen.semanticVersion = 18;
    world.screen.page = "Integrations";
    world.screen.summary = "Integration cards are visible";
    world.screen.perceptionStatus = "clear";
    world.workflow.currentStep = "selectGithub";
    world.workflow.expectedNextState = "GitHub Integration";
    world.workflow.completedSteps = ["openSettings", "openIntegrations"];
    const turns = [
      "User: I want to connect GitHub.",
      "Assistant: Open Settings.",
      "User: Okay.",
      "Assistant: Open Integrations.",
      "User: What is OAuth?",
    ];
    const context = buildReasoningContext(world, turns, {
      expected: "GitHub Integration",
      observed: "API Keys",
    });
    const serialized = JSON.stringify(context);
    expect(context.recentRelevantConversation).toEqual(turns.slice(-4));
    expect(serialized).not.toContain("SCREEN_STATE_UPDATED");
    expect(serialized).not.toContain("FRAME_SAMPLED");
    expect(context.screen.version).toBe(18);
    expect(context.workflow.expectedNextState).toBe("GitHub Integration");
    expect(context.discrepancy).toEqual({
      expected: "GitHub Integration",
      observed: "API Keys",
    });
  });
});
