import { describe, expect, it } from "vitest";
import { KuluController } from "@/lib/embed/controller";
import { outsideWindowInstruction } from "@/lib/workflow/guide";
import { createInitialWorldModel } from "@/lib/world/initial-state";
import { reduceWorld } from "@/lib/world/reducer";

describe("embed host", () => {
  it("follows a reported page without a screen share", () => {
    const controller = new KuluController({
      capture: "events",
      product: () => null,
      canvas: () => null,
      onChange() {},
    });
    controller.page("Settings");
    expect(controller.view().snapshot.world.screen.page).toBe("Settings");
    expect(controller.view().snapshot.world.agent.activeGuide).toMatchObject({
      kind: "action",
      target: "Integrations",
    });
  });

  it("speaks an outside window from the host, then keeps the product page", () => {
    let world = reduceWorld(createInitialWorldModel("session"), {
      type: "SCREEN_STATE_UPDATED",
      screen: {
        page: "GitHub Integration",
        summary: "GitHub Integration is visible",
        semanticChange: true,
        changeType: "navigation",
        relevantElements: [],
        delta: "Navigated to GitHub Integration",
      },
      semanticVersion: 1,
      at: 1,
    });
    world = reduceWorld(world, { type: "HOST_SURFACE", name: "GitHub", state: "opened", at: 2 });
    expect(world.screen.page).toBe("GitHub Integration");
    expect(world.agent.activeGuide).toMatchObject({
      kind: "clarify",
      instruction: outsideWindowInstruction("GitHub"),
    });
    world = reduceWorld(world, { type: "HOST_SURFACE", name: "GitHub", state: "closed", at: 3 });
    expect(world.agent.activeGuide?.instruction).toBe(outsideWindowInstruction("GitHub"));
  });
});
