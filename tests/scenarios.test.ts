import { describe, expect, it } from "vitest";
import { needsDeepReasoning } from "@/lib/agent/router";
import { EnergyVad } from "@/lib/voice/vad";
import { changeRatio } from "@/lib/screen/frame-diff";
import { PIXEL_CHANGE_THRESHOLD } from "@/lib/screen/config";
import { resolveSemanticChange } from "@/lib/screen/perception";

describe("routing and local screen filters", () => {
  it("escalates only on observable conditions", () => {
    expect(
      needsDeepReasoning({
        perceptionStatus: "clear",
        conflictingEvidence: false,
        recoveryAttempts: 0,
        userChangedGoal: false,
      }),
    ).toBe(false);
    expect(
      needsDeepReasoning({
        perceptionStatus: "ambiguous",
        conflictingEvidence: false,
        recoveryAttempts: 0,
        userChangedGoal: false,
      }),
    ).toBe(true);
    expect(
      needsDeepReasoning({
        perceptionStatus: "clear",
        conflictingEvidence: false,
        recoveryAttempts: 2,
        userChangedGoal: false,
      }),
    ).toBe(true);
  });

  it("ignores a tiny luminance change and flags a large one", () => {
    const previous = new Uint8Array(1000).fill(20);
    const hover = new Uint8Array(previous);
    hover[0] = 80;
    const navigation = new Uint8Array(1000).fill(200);
    expect(changeRatio(previous, hover)).toBeLessThan(PIXEL_CHANGE_THRESHOLD);
    expect(changeRatio(previous, navigation)).toBeGreaterThan(PIXEL_CHANGE_THRESHOLD);
  });

  it("treats a page change as a new screen even when vision marks it unchanged", () => {
    expect(
      resolveSemanticChange({
        reported: false,
        previousPage: "Dashboard",
        nextPage: "Settings",
      }),
    ).toBe(true);
    expect(
      resolveSemanticChange({
        reported: false,
        previousPage: "Settings",
        nextPage: "Settings",
      }),
    ).toBe(false);
  });

  it("ends a turn after sustained silence", () => {
    let ended = 0;
    const vad = new EnergyVad({} as AnalyserNode, {
      onSpeechStart: () => undefined,
      onSpeechEnd: () => {
        ended += 1;
      },
    });
    vad.observe(0.2, 0);
    vad.observe(0.2, 100);
    vad.observe(0.01, 200);
    vad.observe(0.01, 799);
    expect(ended).toBe(0);
    vad.observe(0.01, 800);
    expect(ended).toBe(1);
  });
});
