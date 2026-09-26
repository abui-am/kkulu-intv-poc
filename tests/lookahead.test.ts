import { describe, expect, it } from "vitest";
import { buildReasoningContext } from "@/lib/agent/context-builder";
import { isLookaheadEligible, orderCandidates } from "@/lib/agent/lookahead";
import { createInitialWorldModel } from "@/lib/world/initial-state";
import { CandidateSetSchema, LOOKAHEAD_CANDIDATE_COUNT } from "@/schemas/lookahead";
import { ScreenStateSchema } from "@/schemas/screen-state";

function context(overrides: {
  page?: string;
  summary?: string;
  available?: boolean;
  perceptionStatus?: "unknown" | "clear" | "ambiguous";
  latestUserUtterance?: string | null;
  activeQuestion?: string | null;
} = {}) {
  const world = createInitialWorldModel("test-session");
  world.flags.screenAvailable = overrides.available ?? true;
  world.screen.perceptionStatus = overrides.perceptionStatus ?? "clear";
  world.screen.page = overrides.page ?? "Dashboard";
  world.screen.summary = overrides.summary ?? "Workspace dashboard with Settings navigation";
  world.conversation.latestUserUtterance = overrides.latestUserUtterance ?? "I want to connect GitHub";
  world.conversation.activeQuestion = overrides.activeQuestion ?? null;
  return buildReasoningContext(world, []);
}

const signals = {
  perceptionStatus: "clear" as const,
  conflictingEvidence: false,
  userChangedGoal: false,
};

describe("lookahead planning", () => {
  it("requires exactly three candidates and orders them deterministically", () => {
    const candidates = ["c", "a", "b"].map((id) => ({
      id,
      type: "guide" as const,
      instruction: `Choose ${id}`,
      target: id,
      expectedScreenState: "Settings",
    }));
    expect(CandidateSetSchema.parse({ candidates })).toEqual({ candidates });
    expect(orderCandidates(candidates).map((candidate) => candidate.id)).toEqual(["a", "b", "c"]);
    expect(() => orderCandidates(candidates.slice(0, 2))).toThrow("exactly 3");
    expect(() => orderCandidates([candidates[0]!, candidates[1]!, { ...candidates[2]!, instruction: candidates[1]!.instruction }])).toThrow("distinct");
    expect(() => CandidateSetSchema.parse({ candidates: candidates.slice(0, 2) })).toThrow();
  });

  it("allows clear navigation turns and bypasses side questions", () => {
    expect(isLookaheadEligible(context(), signals)).toBe(true);
    expect(isLookaheadEligible(context({ latestUserUtterance: "What is OAuth?" }), signals)).toBe(false);
    expect(isLookaheadEligible(context({ activeQuestion: "What is OAuth?" }), signals)).toBe(false);
  });

  it("bypasses lookahead for loading, ambiguous, unavailable, conflicting, or changed-goal states", () => {
    expect(isLookaheadEligible(context({ page: "Loading" }), signals)).toBe(false);
    expect(isLookaheadEligible(context({ perceptionStatus: "ambiguous" }), signals)).toBe(false);
    expect(isLookaheadEligible(context({ available: false }), signals)).toBe(false);
    expect(isLookaheadEligible(context(), { ...signals, conflictingEvidence: true })).toBe(false);
    expect(isLookaheadEligible(context(), { ...signals, userChangedGoal: true })).toBe(false);
  });

  it("uses the paper's three-root candidate default", () => {
    expect(LOOKAHEAD_CANDIDATE_COUNT).toBe(3);
  });

  it("reads old screen sketches without boxes and validates new normalized boxes", () => {
    const screen = {
      page: "Settings",
      summary: "Settings page",
      semanticChange: true,
      changeType: "navigation",
      relevantElements: [{ label: "Integrations", role: "button" }],
      delta: "Settings opened",
    };
    expect(ScreenStateSchema.parse(screen).relevantElements[0]?.bbox).toBeUndefined();
    expect(ScreenStateSchema.parse({
      ...screen,
      relevantElements: [{ label: "Integrations", role: "button", bbox: [10, 20, 240, 80] }],
    }).relevantElements[0]?.bbox).toEqual([10, 20, 240, 80]);
    expect(() => ScreenStateSchema.parse({
      ...screen,
      relevantElements: [{ label: "Integrations", role: "button", bbox: [-1, 20, 240, 80] }],
    })).toThrow();
  });
});
