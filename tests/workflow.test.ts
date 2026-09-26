import { describe, expect, it } from "vitest";
import { verifyObservation } from "@/lib/workflow/verifier";
import { reduceWorld } from "@/lib/world/reducer";
import { createInitialWorldModel } from "@/lib/world/initial-state";

describe("workflow verifier", () => {
  it("completes the step when Settings is expected and observed", () => {
    const result = verifyObservation({
      currentStep: "openSettings",
      observedPage: "Settings",
      perceptionStatus: "clear",
    });
    expect(result.outcome).toBe("match");
    if (result.outcome !== "match") return;
    const next = reduceWorld(createInitialWorldModel("s1"), {
      type: "WORKFLOW_STEP_VERIFIED",
      stepId: result.stepId,
      at: 1,
    });
    expect(next.workflow.completedSteps).toContain("openSettings");
    expect(next.workflow.currentStep).toBe("openIntegrations");
    expect(next.workflow.expectedNextState).toBe("Integrations");
  });

  it("reports a deviation for API Keys when Integrations was expected", () => {
    const world = createInitialWorldModel("s1");
    world.workflow.currentStep = "openIntegrations";
    world.workflow.expectedNextState = "Integrations";
    const result = verifyObservation({
      currentStep: world.workflow.currentStep,
      observedPage: "API Keys",
      perceptionStatus: "clear",
    });
    expect(result).toEqual({
      outcome: "deviation",
      expected: "Integrations",
      observed: "API Keys",
    });
    const next = reduceWorld(world, {
      type: "WORKFLOW_DEVIATION",
      expected: "Integrations",
      observed: "API Keys",
      at: 2,
    });
    expect(next.workflow.currentStep).toBe("openIntegrations");
    expect(next.workflow.completedSteps).toEqual([]);
    expect(next.flags.conflictingEvidence).toBe(true);
  });

  it("does not advance on a loading screen or an ambiguous observation", () => {
    expect(
      verifyObservation({
        currentStep: "openIntegrations",
        observedPage: "Loading",
        perceptionStatus: "clear",
      }).outcome,
    ).toBe("pending");
    expect(
      verifyObservation({
        currentStep: "openIntegrations",
        observedPage: "Status updating",
        perceptionStatus: "ambiguous",
      }).outcome,
    ).toBe("ambiguous");
  });
});
