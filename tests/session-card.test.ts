import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AgentWidget } from "@/components/agent/AgentWidget";
import type { MirroredSession } from "@/lib/session/channel";

function session(overrides: Partial<MirroredSession> = {}): MirroredSession {
  return {
    active: false,
    ended: false,
    status: "idle",
    hearing: false,
    screenSharing: false,
    guide: {
      kind: "action",
      page: "Integrations",
      stepId: "selectGithub",
      target: "GitHub",
      instruction: "Here's Integrations. Select the GitHub card.",
      expectedPage: "GitHub Integration",
    },
    currentStep: "selectGithub",
    goalStatus: "active",
    verifiedCount: 2,
    skippedCount: 0,
    instruction: "Here's Integrations. Select the GitHub card.",
    ...overrides,
  };
}

function card(props: { session: MirroredSession | null; running: boolean }) {
  return renderToStaticMarkup(createElement(AgentWidget, {
    session: props.session,
    noticing: false,
    running: props.running,
    sharing: false,
    error: null,
    onStart: () => undefined,
    onStop: () => undefined,
    onShare: () => undefined,
    onReset: () => undefined,
    allowShare: true,
    debug: null,
  }));
}

describe("agent card", () => {
  it("shows the current task while the session is live", () => {
    const html = card({ session: session({ active: true, status: "listening" }), running: true });
    expect(html).toContain("Select GitHub");
    expect(html).toContain("Select the GitHub card.");
    expect(html).toContain("Stop");
    expect(html).not.toContain("screens verified");
  });

  it("shows where a paused session stopped", () => {
    const html = card({ session: session({ ended: true }), running: false });
    expect(html).toContain("Stopped at Select GitHub");
    expect(html).toContain("Your place is saved.");
    expect(html).toContain("Continue");
    expect(html).toContain("Start over");
    expect(html).not.toContain("Start the session");
  });

  it("shows a finished setup instead of the welcome", () => {
    const html = card({
      session: session({
        ended: true,
        goalStatus: "completed",
        currentStep: "verifyConnection",
        guide: { kind: "complete", instruction: "You're all set. GitHub is connected." },
      }),
      running: false,
    });
    expect(html).toContain("GitHub is connected");
    expect(html).toContain("the setup.");
    expect(html).toContain("Walk through again");
    expect(html).not.toContain("Share entire screen");
  });

  it("says Done while a connected session is still open", () => {
    const html = card({
      session: session({
        active: true,
        status: "listening",
        goalStatus: "completed",
        guide: { kind: "complete", instruction: "You're all set. GitHub is connected." },
      }),
      running: true,
    });
    expect(html).toContain("Done");
    expect(html).toContain("all set. GitHub is connected.");
    expect(html).not.toContain(">Listening<");
    expect(html).not.toContain("Current action");
  });
});
