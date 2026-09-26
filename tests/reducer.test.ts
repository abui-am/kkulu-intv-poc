import { describe, expect, it } from "vitest";
import { dispatch, type SessionLog } from "@/lib/events/dispatcher";
import type { ScreenState } from "@/schemas/screen-state";
import { createInitialWorldModel } from "@/lib/world/initial-state";
import { reduceWorld } from "@/lib/world/reducer";
import { nextSemanticVersion } from "@/lib/screen/perception";

const screen = (page: string, semanticChange: boolean): ScreenState => ({
  page,
  summary: `${page} is visible`,
  semanticChange,
  changeType: semanticChange ? "navigation" : "none",
  relevantElements: [],
  delta: semanticChange ? "navigated" : "no meaningful change",
});

describe("world model reducer", () => {
  it("stores the final utterance without changing the workflow", () => {
    const start = createInitialWorldModel("s1");
    const next = reduceWorld(start, {
      type: "USER_TRANSCRIPT_FINAL",
      text: "What is OAuth?",
      itemId: "item_1",
      at: 1,
    });
    expect(next.conversation.latestUserUtterance).toBe("What is OAuth?");
    expect(next.conversation.activeQuestion).toBe("What is OAuth?");
    expect(next.workflow.currentStep).toBe("openSettings");
  });

  it("changes semantic version only when the event says the screen changed", () => {
    const start = createInitialWorldModel("s1");
    expect(nextSemanticVersion(0, false)).toBe(0);
    expect(nextSemanticVersion(4, true)).toBe(5);
    const same = reduceWorld(start, {
      type: "SCREEN_STATE_UPDATED",
      screen: screen("Dashboard", false),
      semanticVersion: 0,
      at: 2,
    });
    const changed = reduceWorld(same, {
      type: "SCREEN_STATE_UPDATED",
      screen: screen("Settings", true),
      semanticVersion: 1,
      at: 3,
    });
    expect(same.screen.semanticVersion).toBe(0);
    expect(changed.screen.semanticVersion).toBe(1);
    expect(changed.screen.page).toBe("Settings");
  });

  it("marks speech interrupted without advancing the workflow", () => {
    const speaking = reduceWorld(createInitialWorldModel("s1"), {
      type: "AGENT_SPEECH_STARTED",
      decisionId: "d1",
      at: 1,
    });
    speaking.workflow.currentStep = "authorizeGithub";
    const interrupted = reduceWorld(speaking, {
      type: "AGENT_INTERRUPTED",
      decisionId: "d1",
      at: 2,
    });
    expect(interrupted.agent.status).toBe("listening");
    expect(interrupted.agent.speechInterrupted).toBe(true);
    expect(interrupted.workflow.currentStep).toBe("authorizeGithub");
    expect(interrupted.workflow.completedSteps).toEqual([]);
  });

  it("keeps only the last 100 events", () => {
    let log: SessionLog = { world: createInitialWorldModel("s1"), events: [] };
    for (let index = 0; index < 120; index += 1) {
      log = dispatch(log, { type: "SCREEN_CHANGE_CANDIDATE", at: index });
    }
    expect(log.events).toHaveLength(100);
    expect(log.events[0]?.at).toBe(20);
  });
});
