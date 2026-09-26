import { describe, expect, it } from "vitest";
import { renderTraceHtml } from "@/lib/session/trace-html";

describe("session trace html", () => {
  it("embeds state text and the screenshot that belongs to that step", () => {
    const html = renderTraceHtml("session-1", [
      {
        at: 1_700_000_000_000,
        event: "SCREEN_STABILIZED",
        detail: "frame-1",
        state: '{\n  "page": "Settings"\n}',
        screenshot: "data:image/jpeg;base64,abc",
      },
      {
        at: 1_700_000_001_000,
        event: "DECISION_READY",
        detail: "guide",
        state: '{\n  "response": "Open Integrations."\n}',
        screenshot: null,
      },
    ]);
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("Settings");
    expect(html).toContain("Open Integrations.");
    expect(html).toContain("data:image/jpeg;base64,abc");
    expect(html).toContain("screenshotFor");
  });
});
