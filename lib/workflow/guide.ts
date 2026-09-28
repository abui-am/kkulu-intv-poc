import { canonicalizePage, type CanonicalPage } from "@/lib/workflow/pages";
import type { PerceptionStatus, ScreenElement, WorkflowStepId } from "@/lib/world/types";

export type ScreenReview = "normal" | "checking_target" | "missing_target" | "checking_transition" | "stalled_transition" | "stalled_shared_surface" | "screen_lag" | "checking_connection" | "missing_connection" | "confirmed_connection";

export type Guide =
  | {
      kind: "action";
      page: CanonicalPage;
      stepId: WorkflowStepId | null;
      target: string;
      instruction: string;
      expectedPage: string;
    }
  | { kind: "wait" | "clarify" | "reconnect" | "complete"; instruction: string };

const ACTIONS: Partial<Record<CanonicalPage, Extract<Guide, { kind: "action" }>>> = {
  Dashboard: {
    kind: "action",
    page: "Dashboard",
    stepId: "openSettings",
    target: "Open Settings",
    instruction: "Click Open Settings.",
    expectedPage: "Settings",
  },
  Settings: {
    kind: "action",
    page: "Settings",
    stepId: "openIntegrations",
    target: "Integrations",
    instruction: "Click Integrations in Settings.",
    expectedPage: "Integrations",
  },
  Integrations: {
    kind: "action",
    page: "Integrations",
    stepId: "selectGithub",
    target: "GitHub",
    instruction: "Select the GitHub integration card.",
    expectedPage: "GitHub Integration",
  },
  "GitHub Integration": {
    kind: "action",
    page: "GitHub Integration",
    stepId: "authorizeGithub",
    target: "Connect GitHub",
    instruction: "Click Connect GitHub.",
    expectedPage: "GitHub Authorization",
  },
  "GitHub Authorization": {
    kind: "action",
    page: "GitHub Authorization",
    stepId: "verifyConnection",
    target: "Authorize",
    instruction: "Review the requested permissions, then click Authorize if you agree.",
    expectedPage: "GitHub Connected",
  },
  "API Keys": {
    kind: "action",
    page: "API Keys",
    stepId: null,
    target: "Settings",
    instruction: "Click Settings in the sidebar to return to the GitHub setup path.",
    expectedPage: "Settings",
  },
};

const STATIC_INSTRUCTIONS = [
  "Share the entire screen again so I can see where you are.",
  "I can't read this screen clearly yet. Please keep the sandbox visible.",
  "GitHub is connected.",
  "I can't confirm the GitHub success message. Please keep that page visible.",
  "I can't verify the next control on this screen. Please show the page clearly.",
  "I can't identify this page. Please show the sandbox window clearly.",
  "The shared screen has not caught up with this page yet. Stay here for a moment.",
  "The sandbox changed pages, but the shared view did not. Share the sandbox window you clicked.",
];

export function stalledSharedInstruction(page: string, expectedPage: string): string {
  return `The sandbox reached ${expectedPage}, but the shared view still shows ${page}. Share the sandbox window you clicked.`;
}

export function outsideWindowInstruction(name: string): string {
  const safe = name.trim().replace(/\s+/g, " ").slice(0, 40) || "another";
  return `A ${safe} window opened. Finish that step, then return here.`;
}

export function scriptedInstructions(): string[] {
  const stalled = Object.values(ACTIONS).map((action) => stalledSharedInstruction(action.page, action.expectedPage));
  return [
    ...Object.values(ACTIONS).map((action) => action.instruction),
    ...STATIC_INSTRUCTIONS,
    ...stalled,
    outsideWindowInstruction("GitHub"),
  ];
}

function normalized(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function actionForPage(page: string | null): Extract<Guide, { kind: "action" }> | null {
  const canonical = canonicalizePage(page);
  return canonical ? ACTIONS[canonical] ?? null : null;
}

export function targetVisible(page: string | null, elements: ScreenElement[]): boolean {
  const action = actionForPage(page);
  if (!action) return true;
  const target = normalized(action.target);
  return elements.some((element) => {
    const label = normalized(element.label);
    const disabled = /disabled|unavailable|hidden/i.test(element.state ?? "");
    const interactive = /button|link|card|tab|menuitem/i.test(element.role);
    return !disabled && interactive && (label === target || label.includes(target));
  });
}

export function connectedEvidence(summary: string, elements: ScreenElement[]): boolean {
  if (/\bnot\s+connected\b|\bfailed\b|\berror\b|\bunsuccessful\b|\bdisconnected\b/i.test(summary)) return false;
  const success = /\bgithub\s+connected\b|\bconnected\s+to\s+github\b|\bsuccess\b/i;
  return success.test(summary) && elements.some((element) => success.test(element.label));
}

export function guideForObservation(input: {
  page: string | null;
  perceptionStatus: PerceptionStatus;
  screenAvailable: boolean;
  review?: ScreenReview;
}): Guide {
  if (!input.screenAvailable) {
    return { kind: "reconnect", instruction: "Share the entire screen again so I can see where you are." };
  }
  if (input.perceptionStatus !== "clear") {
    return { kind: "clarify", instruction: "I can't read this screen clearly yet. Please keep the sandbox visible." };
  }
  const page = canonicalizePage(input.page);
  if (page === "Loading") return { kind: "wait", instruction: "Wait for Integrations to finish loading." };
  if (page === "GitHub Connected") {
    if (input.review === "confirmed_connection") return { kind: "complete", instruction: "GitHub is connected." };
    if (input.review === "missing_connection") return { kind: "clarify", instruction: "I can't confirm the GitHub success message. Please keep that page visible." };
    return { kind: "wait", instruction: "Checking GitHub connection…" };
  }
  if (input.review === "checking_transition") {
    return { kind: "wait", instruction: "Checking the result of your click…" };
  }
  if (input.review === "stalled_transition") {
    const action = actionForPage(page);
    return { kind: "wait", instruction: action
      ? `The shared window did not change after ${action.target}. Make sure this is the sandbox window you clicked.`
      : "The shared window did not change. Make sure this is the sandbox window you clicked." };
  }
  if (input.review === "screen_lag") {
    return { kind: "clarify", instruction: "The shared screen has not caught up with this page yet. Stay here for a moment." };
  }
  if (input.review === "stalled_shared_surface") {
    const action = actionForPage(page);
    return { kind: "clarify", instruction: action
      ? stalledSharedInstruction(action.page, action.expectedPage)
      : "The sandbox changed pages, but the shared view did not. Share the sandbox window you clicked." };
  }
  if (input.review === "checking_target") {
    return { kind: "wait", instruction: "Checking that the next control is visible…" };
  }
  if (input.review === "missing_target") {
    return { kind: "clarify", instruction: "I can't verify the next control on this screen. Please show the page clearly." };
  }
  return (page && ACTIONS[page]) || {
    kind: "clarify",
    instruction: "I can't identify this page. Please show the sandbox window clearly.",
  };
}
