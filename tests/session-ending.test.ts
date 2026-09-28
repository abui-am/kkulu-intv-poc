import { describe, expect, it } from "vitest";
import { SessionRuntime } from "@/lib/session/runtime";
import { cardCopy, cardPhase } from "@/lib/session/closing";

function runtime() {
  let snapshot = new SessionRuntime(() => undefined).snapshot();
  const session = new SessionRuntime((next) => {
    snapshot = next;
  });
  return { session, read: () => snapshot };
}

describe("session ending", () => {
  it("keeps the current task when the user stops", () => {
    const { session, read } = runtime();
    session.reportPage("Settings");
    session.stop();
    const world = read().world;
    expect(read().ended).toBe(true);
    expect(world.goal.status).toBe("active");
    expect(world.workflow.currentStep).toBe("openIntegrations");
    expect(world.agent.activeGuide?.kind).toBe("action");
    expect(world.agent.activeGuide?.instruction).not.toMatch(/lost the screen/i);
    expect(cardCopy({
      phase: cardPhase({
        running: false,
        ended: true,
        goalStatus: world.goal.status,
        guideKind: world.agent.activeGuide?.kind ?? null,
      }),
      currentStep: world.workflow.currentStep,
      instruction: world.agent.activeGuide?.instruction ?? null,
    })).toMatchObject({
      heading: "Stopped at Open Integrations",
      body: "Your place is saved.",
      primary: "continue",
    });
  });

  it("keeps a finished connection instead of asking to share the screen again", () => {
    const { session, read } = runtime();
    for (const page of ["Settings", "Integrations", "GitHub Integration", "GitHub Authorization", "GitHub Connected"]) {
      session.reportPage(page);
    }
    session.stop();
    const world = read().world;
    expect(world.goal.status).toBe("completed");
    expect(world.agent.activeGuide?.kind).toBe("complete");
    expect(cardCopy({
      phase: cardPhase({
        running: false,
        ended: true,
        goalStatus: world.goal.status,
        guideKind: world.agent.activeGuide?.kind ?? null,
      }),
      currentStep: world.workflow.currentStep,
      instruction: world.agent.activeGuide?.instruction ?? null,
    })).toMatchObject({
      heading: "GitHub is connected",
      body: "That's the setup.",
      primary: "again",
    });
  });

  it("names the live task and treats a connected guide as done", () => {
    expect(cardCopy({
      phase: "live",
      currentStep: "selectGithub",
      instruction: "Here's Integrations. Select the GitHub card.",
    })).toMatchObject({ heading: "Select GitHub", primary: "stop" });
    expect(cardPhase({
      running: true,
      ended: false,
      goalStatus: "active",
      guideKind: "complete",
    })).toBe("done");
    expect(cardCopy({ phase: "welcome", currentStep: "openSettings", instruction: null }).heading).toBeNull();
  });
});
