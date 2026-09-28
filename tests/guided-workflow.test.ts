import { describe, expect, it } from "vitest";
import { guidedDecision } from "@/lib/agent/guide-decision";
import { connectGithub } from "@/lib/workflow/connect-github";
import { guideForObservation, scriptedInstructions, stalledSharedInstruction } from "@/lib/workflow/guide";
import { compileWorkflow } from "@/lib/workflow/manual";
import { observeProgress } from "@/lib/workflow/progress";
import { createInitialWorldModel } from "@/lib/world/initial-state";
import { reduceWorld } from "@/lib/world/reducer";
import type { ScreenState } from "@/schemas/screen-state";
import type { WorldModel } from "@/lib/world/types";

function screen(page: string): ScreenState {
  return {
    page,
    summary: `${page} is visible`,
    semanticChange: true,
    changeType: "navigation",
    relevantElements: [],
    delta: `Navigated to ${page}`,
  };
}

function observe(world: WorldModel, page: string): WorldModel {
  const seen = reduceWorld(world, {
    type: "SCREEN_STATE_UPDATED",
    screen: screen(page),
    semanticVersion: world.screen.semanticVersion + 1,
    review: page === "GitHub Connected" && world.screen.page === "GitHub Connected"
      ? "confirmed_connection" : "normal",
    at: world.screen.semanticVersion + 1,
  });
  const progress = observeProgress(seen.workflow.definition, {
    currentStep: seen.workflow.currentStep,
    completedSteps: seen.workflow.completedSteps,
    skippedSteps: seen.workflow.skippedSteps,
    observedPage: seen.screen.page,
    perceptionStatus: seen.screen.perceptionStatus,
    review: seen.screen.review,
  });
  if (progress.outcome !== "advance" && progress.outcome !== "revisit") return seen;
  return reduceWorld(seen, {
    type: "WORKFLOW_PROGRESS_RECONCILED",
    observedStep: progress.observedStep,
    skippedSteps: progress.outcome === "advance" ? progress.skippedSteps : [],
    at: seen.screen.semanticVersion,
  });
}

describe("GitHub guide and observed progress", () => {
  it("follows a saved manual instead of the built-in GitHub path", () => {
    const workflow = compileWorkflow("Open API keys from the dashboard.", [
      {
        page: "Dashboard",
        instruction: "From the manual: open API Keys.",
        target: "Create an API token",
        expectedPage: "API Keys",
      },
    ]);
    expect(workflow).not.toBeNull();
    if (!workflow) return;
    expect(guideForObservation(workflow, {
      page: "Dashboard",
      perceptionStatus: "clear",
      screenAvailable: true,
    })).toMatchObject({
      kind: "action",
      target: "Create an API token",
      expectedPage: "API Keys",
      instruction: "From the manual: open API Keys.",
    });
    const started = createInitialWorldModel("custom", workflow);
    expect(started.goal.description).toBe("Open API keys from the dashboard.");
    expect(started.workflow).toMatchObject({ currentStep: "step-1", expectedNextState: "API Keys" });
    expect(observe(started, "API Keys").goal.status).toBe("completed");
    expect(guideForObservation(workflow, {
      page: "Settings",
      perceptionStatus: "clear",
      screenAvailable: true,
    }).instruction).toContain("isn't in the workflow");
  });

  it("guides through all observed pages to completion", () => {
    let world = observe(createInitialWorldModel("session"), "Dashboard");
    expect(world.agent.activeGuide).toMatchObject({ target: "Open Settings", expectedPage: "Settings" });
    for (const page of ["Settings", "Integrations", "GitHub Integration", "GitHub Authorization", "GitHub Connected", "GitHub Connected"]) {
      world = observe(world, page);
    }
    expect(world.workflow.completedSteps).toEqual([
      "openSettings", "openIntegrations", "selectGithub", "authorizeGithub", "verifyConnection",
    ]);
    expect(world.workflow.skippedSteps).toEqual([]);
    expect(world.goal.status).toBe("completed");
    expect(world.agent.activeGuide?.kind).toBe("complete");
  });

  it("catches up when Settings was not observed, then guides from the actual page", () => {
    let world = observe(createInitialWorldModel("session"), "Dashboard");
    world = observe(world, "Integrations");
    expect(world.workflow.completedSteps).toEqual(["openIntegrations"]);
    expect(world.workflow.skippedSteps).toEqual(["openSettings"]);
    expect(world.workflow.currentStep).toBe("selectGithub");
    expect(world.agent.activeGuide).toMatchObject({ target: "GitHub", expectedPage: "GitHub Integration" });

    world = observe(world, "Dashboard");
    expect(world.workflow.currentStep).toBe("selectGithub");
    expect(world.workflow.completedSteps).toEqual(["openIntegrations"]);
    expect(world.agent.activeGuide).toMatchObject({ target: "Open Settings" });

    world = observe(world, "Settings");
    expect(world.workflow.completedSteps).toEqual(["openSettings", "openIntegrations"]);
    expect(world.workflow.skippedSteps).toEqual([]);
    expect(world.workflow.currentStep).toBe("selectGithub");
  });

  it("accepts a directly observed connected screen without claiming unseen milestones", () => {
    let world = observe(observe(createInitialWorldModel("session"), "GitHub Connected"), "GitHub Connected");
    expect(world.goal.status).toBe("completed");
    expect(world.workflow.currentStep).toBe("verifyConnection");
    expect(world.workflow.completedSteps).toEqual(["verifyConnection"]);
    expect(world.workflow.skippedSteps).toEqual([
      "openSettings", "openIntegrations", "selectGithub", "authorizeGithub",
    ]);
    world = reduceWorld(world, {
      type: "TRANSITION_REFLECTED",
      reflection: {
        decisionId: "earlier-action",
        subgoal: "authorizeGithub",
        expectedPage: "GitHub Authorization",
        observedPage: "GitHub Connected",
        status: "mismatch",
        result: null,
      },
      at: 2,
    });
    expect(world.goal.status).toBe("completed");
    expect(world.workflow.completedSteps).toEqual(["verifyConnection"]);
  });

  it("asks the user to wait when the shared screen has not caught up", () => {
    const guide = guideForObservation(connectGithub, {
      page: "Settings",
      perceptionStatus: "clear",
      screenAvailable: true,
      review: "screen_lag",
    });
    expect(guide).toMatchObject({ kind: "clarify", instruction: "The shared screen is a beat behind. Stay on this page for a second." });
  });

  it("keeps the back-navigation lines with the other scripted speech", () => {
    const lines = scriptedInstructions(connectGithub);
    const stalled = stalledSharedInstruction("Settings", "Integrations");
    expect(lines).toContain("The shared screen is a beat behind. Stay on this page for a second.");
    expect(lines).toContain(stalled);
    expect(guideForObservation(connectGithub, {
      page: "Settings",
      perceptionStatus: "clear",
      screenAvailable: true,
      review: "stalled_shared_surface",
    }).instruction).toBe(stalled);
  });

  it("tells the user to leave Billing and click Integrations", () => {
    let world = observe(createInitialWorldModel("session"), "Settings");
    world = reduceWorld(world, { type: "SANDBOX_INTERACTION", label: "Billing", at: 2 });
    expect(world.agent.activeGuide).toMatchObject({
      kind: "clarify",
      instruction: "That's Billing. Payment doesn't connect GitHub. Click Integrations.",
    });
    world = reduceWorld(world, {
      type: "SCREEN_STATE_UPDATED",
      screen: screen("Settings"),
      semanticVersion: world.screen.semanticVersion + 1,
      review: "normal",
      at: 3,
    });
    expect(world.agent.activeGuide?.instruction).toBe("That's Billing. Payment doesn't connect GitHub. Click Integrations.");
    world = reduceWorld(world, { type: "SANDBOX_PAGE_REPORTED", page: "Loading", at: 4 });
    expect(world.agent.activeGuide).toMatchObject({ kind: "wait" });
  });

  it("keeps the current instruction when a click is noticed, then follows a reported page", () => {
    let world = observe(createInitialWorldModel("session"), "Settings");
    const guide = world.agent.activeGuide;
    world = reduceWorld(world, { type: "SANDBOX_INTERACTION", label: "Integrations", at: 2 });
    expect(world.agent.activeGuide).toEqual(guide);
    world = reduceWorld(world, { type: "SANDBOX_PAGE_REPORTED", page: "Loading", at: 3 });
    expect(world.agent.activeGuide).toMatchObject({ kind: "wait", instruction: "Integrations is still loading. Give it a moment." });
    world = reduceWorld(world, { type: "SESSION_STARTED", at: 4 });
    world = observe(world, "Integrations");
    expect(world.agent.activeGuide).toMatchObject({ target: "GitHub", expectedPage: "GitHub Integration" });
  });

  it("keeps the prescribed action visible after a side answer and reshare", () => {
    let world = observe(createInitialWorldModel("session"), "Settings");
    const guide = world.agent.activeGuide;
    world = reduceWorld(world, {
      type: "DECISION_READY",
      decision: {
        id: "answer",
        type: "answer",
        basedOnScreenVersion: 1,
        response: "GitHub authorization lets Northstar read repository metadata.",
        reasoningClass: "question",
        requiresDeepReasoning: false,
      },
      at: 2,
    });
    expect(world.agent.activeGuide).toEqual(guide);
    world = reduceWorld(world, { type: "SCREEN_UNAVAILABLE", at: 3 });
    expect(world.agent.activeGuide?.kind).toBe("reconnect");
    world = observe(world, "Settings");
    expect(world.workflow.currentStep).toBe("openIntegrations");
    expect(world.agent.activeGuide).toMatchObject({ target: "Integrations" });
  });

  it("prescribes recovery for API Keys and overrides an invented navigation target", () => {
    const guide = guideForObservation(connectGithub, { page: "API Keys", perceptionStatus: "clear", screenAvailable: true });
    expect(guide).toMatchObject({ kind: "action", target: "Settings" });
    const decision = guidedDecision({
      id: "model",
      type: "guide",
      basedOnScreenVersion: 2,
      target: "Delete API key",
      expectedScreenState: "API Keys",
      response: "Delete the API key.",
      reasoningClass: "normal_flow",
      requiresDeepReasoning: false,
    }, guide, null);
    expect(decision.response).toBe("This is API Keys, a little off the path. Click Settings in the sidebar and we'll get back to GitHub.");
    expect(decision.expectedScreenState).toBe("Settings");
  });

  it("prioritizes restoring the screen share over a pending side question", () => {
    const guide = guideForObservation(connectGithub, { page: null, perceptionStatus: "unknown", screenAvailable: false });
    const decision = guidedDecision({
      id: "model",
      type: "answer",
      basedOnScreenVersion: 2,
      response: "The next page is GitHub Authorization.",
      reasoningClass: "question",
      requiresDeepReasoning: false,
    }, guide, "What comes next?");
    expect(decision.type).toBe("recover");
    expect(decision.response).toContain("Share the entire screen again");
  });
});
