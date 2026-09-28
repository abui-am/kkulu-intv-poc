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
    instruction: "You're on the dashboard. Hit Open Settings and we'll go from there.",
    expectedPage: "Settings",
  },
  Settings: {
    kind: "action",
    page: "Settings",
    stepId: "openIntegrations",
    target: "Integrations",
    instruction: "Good, Settings is open. Click Integrations next.",
    expectedPage: "Integrations",
  },
  Integrations: {
    kind: "action",
    page: "Integrations",
    stepId: "selectGithub",
    target: "GitHub",
    instruction: "Here's Integrations. Select the GitHub card.",
    expectedPage: "GitHub Integration",
  },
  "GitHub Integration": {
    kind: "action",
    page: "GitHub Integration",
    stepId: "authorizeGithub",
    target: "Connect GitHub",
    instruction: "This is the GitHub integration. Click Connect GitHub when you're ready.",
    expectedPage: "GitHub Authorization",
  },
  "GitHub Authorization": {
    kind: "action",
    page: "GitHub Authorization",
    stepId: "verifyConnection",
    target: "Authorize",
    instruction: "Take a look at the permissions, then click Authorize if that feels right.",
    expectedPage: "GitHub Connected",
  },
  "API Keys": {
    kind: "action",
    page: "API Keys",
    stepId: null,
    target: "Settings",
    instruction: "This is API Keys, a little off the path. Click Settings in the sidebar and we'll get back to GitHub.",
    expectedPage: "Settings",
  },
};

const STATIC_INSTRUCTIONS = [
  "I lost the screen. Share the entire screen again and I'll catch up.",
  "I can't quite read this yet. Keep the sandbox in view for me.",
  "You're all set. GitHub is connected.",
  "I don't see the GitHub success message yet. Leave that page up so I can check.",
  "I can't see the next button. Give me a clear view of the page.",
  "I'm not sure which page this is. Bring the sandbox window into view.",
  "The shared screen is a beat behind. Stay on this page for a second.",
  "The sandbox moved, but my view didn't. Share the sandbox window you clicked.",
];

export function stalledSharedInstruction(page: string, expectedPage: string): string {
  return `The sandbox made it to ${expectedPage}, but I'm still seeing ${page}. Share the sandbox window you clicked.`;
}

export function outsideWindowInstruction(name: string): string {
  const safe = name.trim().replace(/\s+/g, " ").slice(0, 40) || "another";
  return `A ${safe} window popped open. Finish what you need there, then come back.`;
}

const SETTINGS_DETOURS: Record<string, string> = {
  billing: "That's Billing. Payment doesn't connect GitHub. Click Integrations.",
  "update payment method": "That's the payment method. It still doesn't connect GitHub. Click Integrations.",
};

export function scriptedInstructions(): string[] {
  const stalled = Object.values(ACTIONS).map((action) => stalledSharedInstruction(action.page, action.expectedPage));
  return [
    ...Object.values(ACTIONS).map((action) => action.instruction),
    ...STATIC_INSTRUCTIONS,
    ...stalled,
    ...Object.values(SETTINGS_DETOURS),
    outsideWindowInstruction("GitHub"),
  ];
}

export function clickMatchesTarget(label: string, target: string): boolean {
  const clicked = normalized(label);
  const expected = normalized(target);
  if (!clicked || !expected) return false;
  return clicked.includes(expected) || (expected.includes(clicked) && clicked.length >= 4);
}

export function samePageDetour(page: string | null, label: string): string | null {
  const canonical = canonicalizePage(page);
  const action = actionForPage(canonical);
  if (!canonical || !action || clickMatchesTarget(label, action.target)) return null;
  if (canonical !== "Settings") return null;
  return SETTINGS_DETOURS[normalized(label)] ?? null;
}

export function isSamePageDetour(guide: Guide | null): guide is Extract<Guide, { kind: "clarify" }> {
  return guide?.kind === "clarify" && Object.values(SETTINGS_DETOURS).includes(guide.instruction);
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
    return { kind: "reconnect", instruction: "I lost the screen. Share the entire screen again and I'll catch up." };
  }
  if (input.perceptionStatus !== "clear") {
    return { kind: "clarify", instruction: "I can't quite read this yet. Keep the sandbox in view for me." };
  }
  const page = canonicalizePage(input.page);
  if (page === "Loading") return { kind: "wait", instruction: "Integrations is still loading. Give it a moment." };
  if (page === "GitHub Connected") {
    if (input.review === "confirmed_connection") return { kind: "complete", instruction: "You're all set. GitHub is connected." };
    if (input.review === "missing_connection") return { kind: "clarify", instruction: "I don't see the GitHub success message yet. Leave that page up so I can check." };
    return { kind: "wait", instruction: "Hang on, I'm checking that GitHub actually connected." };
  }
  if (input.review === "checking_transition") {
    return { kind: "wait", instruction: "One second, I'm checking what that click did." };
  }
  if (input.review === "stalled_transition") {
    const action = actionForPage(page);
    return { kind: "wait", instruction: action
      ? `The window didn't change after ${action.target}. Make sure this is the sandbox you clicked.`
      : "The window didn't change. Make sure this is the sandbox you clicked." };
  }
  if (input.review === "screen_lag") {
    return { kind: "clarify", instruction: "The shared screen is a beat behind. Stay on this page for a second." };
  }
  if (input.review === "stalled_shared_surface") {
    const action = actionForPage(page);
    return { kind: "clarify", instruction: action
      ? stalledSharedInstruction(action.page, action.expectedPage)
      : "The sandbox moved, but my view didn't. Share the sandbox window you clicked." };
  }
  if (input.review === "checking_target") {
    return { kind: "wait", instruction: "One second, I'm making sure the next button is on screen." };
  }
  if (input.review === "missing_target") {
    return { kind: "clarify", instruction: "I can't see the next button. Give me a clear view of the page." };
  }
  return (page && ACTIONS[page]) || {
    kind: "clarify",
    instruction: "I'm not sure which page this is. Bring the sandbox window into view.",
  };
}
