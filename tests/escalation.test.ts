import { describe, expect, it } from "vitest";
import { connectedEvidence } from "@/lib/workflow/guide";
import { compileWorkflow } from "@/lib/workflow/manual";
import { cardCopy, cardPhase } from "@/lib/session/closing";
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

function show(world: WorldModel, page: string, review: "normal" | "missing_connection" = "normal"): WorldModel {
  return reduceWorld(world, {
    type: "SCREEN_STATE_UPDATED",
    screen: screen(page),
    semanticVersion: world.screen.semanticVersion + 1,
    review,
    at: world.screen.semanticVersion + 1,
  });
}

describe("escalation", () => {
  it("follows a compiled workflow's blocker and success phrases", () => {
    const workflow = compileWorkflow("Save an API token.", [{
      page: "Dashboard",
      instruction: "From the manual: open API Keys.",
      target: "Create an API token",
      expectedPage: "API Keys",
      blockers: [{
        label: "Archive",
        summary: "Archiving the workspace needs an admin.",
        instruction: "Archiving needs an admin. I'll flag it for someone on the team.",
      }],
      confirm: {
        done: "You're all set. The token is saved.",
        checking: "Hang on, I'm checking the token.",
        missing: "I don't see the saved token yet.",
        success: ["token saved"],
        failure: ["not saved"],
      },
    }]);
    expect(workflow).not.toBeNull();
    if (!workflow) return;
    let world = createInitialWorldModel("custom", workflow);
    world = show(world, "Dashboard");
    world = reduceWorld(world, { type: "SANDBOX_INTERACTION", label: "Archive this workspace", at: 2 });
    expect(world.escalation).toMatchObject({
      reason: "blocker",
      instruction: "Archiving needs an admin. I'll flag it for someone on the team.",
    });
    expect(world.escalation?.summary).toContain("admin");
    const evidence = workflow.steps[0].confirm;
    expect(evidence).toBeTruthy();
    if (!evidence) return;
    expect(connectedEvidence("Token saved for this workspace.", [{ label: "Token saved", role: "status" }], evidence)).toBe(true);
    expect(connectedEvidence("GitHub connected", [{ label: "Success", role: "status" }], evidence)).toBe(false);
    expect(connectedEvidence("Token not saved.", [{ label: "Token saved", role: "status" }], evidence)).toBe(false);
  });

  it("flags Slack because a paid seat is a blocker this workflow cannot clear", () => {
    let world = show(createInitialWorldModel("session"), "Integrations");
    world = { ...world, workflow: { ...world.workflow, currentStep: "selectGithub" } };
    world = reduceWorld(world, {
      type: "SANDBOX_INTERACTION",
      label: "POPULAR Slack Most teams start here",
      at: 2,
    });
    expect(world.goal.status).toBe("blocked");
    expect(world.escalation).toMatchObject({
      reason: "blocker",
      page: "Integrations",
      stepId: "selectGithub",
    });
    expect(world.escalation?.summary).toContain("paid seat");
    expect(world.escalation?.summary).toContain("Select GitHub");
    expect(world.agent.activeGuide).toMatchObject({
      kind: "escalate",
      instruction: "Slack needs a paid seat, and I can't grant that. I'll flag it for someone on the team.",
    });
    world = show(world, "Integrations");
    expect(world.agent.activeGuide?.kind).toBe("escalate");
    world = show(world, "GitHub Integration");
    expect(world.escalation).toBeNull();
    expect(world.goal.status).toBe("active");
    expect(world.agent.activeGuide).toMatchObject({ target: "Connect GitHub" });
  });

  it("leaves GitHub and HubSpot on the guide", () => {
    let world = show(createInitialWorldModel("session"), "Integrations");
    const guide = world.agent.activeGuide;
    world = reduceWorld(world, { type: "SANDBOX_INTERACTION", label: "GitHub Repositories, pull requests, and issues", at: 2 });
    expect(world.escalation).toBeNull();
    expect(world.agent.activeGuide).toEqual(guide);
    world = reduceWorld(world, { type: "SANDBOX_INTERACTION", label: "HubSpot CRM contacts and deals", at: 3 });
    expect(world.escalation).toBeNull();
  });

  it("flags a person only after the expected screen is missed twice", () => {
    let world = createInitialWorldModel("session");
    world = reduceWorld(world, { type: "WORKFLOW_DEVIATION", expected: "Settings", observed: "API Keys", at: 1 });
    expect(world.goal.status).toBe("active");
    expect(world.escalation).toBeNull();
    expect(world.workflow.recoveryAttempts).toBe(1);
    world = reduceWorld(world, { type: "WORKFLOW_DEVIATION", expected: "Settings", observed: "API Keys", at: 2 });
    expect(world.escalation?.reason).toBe("stuck");
    expect(world.escalation?.summary).toContain("API Keys");
    expect(world.goal.status).toBe("blocked");
  });

  it("flags a request for a person and keeps it when the page changes", () => {
    let world = show(createInitialWorldModel("session"), "Settings");
    world = reduceWorld(world, {
      type: "USER_TRANSCRIPT_FINAL",
      text: "Can I talk to a person?",
      itemId: "u1",
      at: 2,
    });
    expect(world.escalation?.reason).toBe("asked");
    expect(world.escalation?.summary).toContain("Can I talk to a person?");
    world = show(world, "Integrations");
    expect(world.escalation?.reason).toBe("asked");
    expect(world.agent.activeGuide?.kind).toBe("escalate");
    const ordinary = reduceWorld(show(createInitialWorldModel("session"), "Settings"), {
      type: "USER_TRANSCRIPT_FINAL",
      text: "What does Integrations do?",
      itemId: "u2",
      at: 3,
    });
    expect(ordinary.escalation).toBeNull();
  });

  it("flags a connection that still is not confirmed", () => {
    const world = show(createInitialWorldModel("session"), "GitHub Connected", "missing_connection");
    expect(world.escalation?.reason).toBe("unconfirmed");
    expect(world.escalation?.summary).toContain("success message");
    expect(world.goal.status).toBe("blocked");
    expect(cardPhase({
      running: true,
      ended: false,
      goalStatus: world.goal.status,
      guideKind: world.agent.activeGuide?.kind ?? null,
    })).toBe("escalated");
    expect(cardCopy({
      phase: "escalated",
      currentStep: world.workflow.currentStep,
      instruction: world.agent.activeGuide?.instruction ?? null,
      handoff: world.escalation?.summary,
    })).toMatchObject({
      heading: "Flagged for the team",
      primary: "done",
    });
  });
});
