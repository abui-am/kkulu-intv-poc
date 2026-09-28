import { canonicalizePage, type CanonicalPage } from "@/lib/workflow/pages";
import type { ConnectionConfirm, Workflow } from "@/lib/workflow/model";
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
  | { kind: "wait" | "clarify" | "reconnect" | "complete" | "escalate"; instruction: string };

type ActionGuide = Extract<Guide, { kind: "action" }>;

const STATIC_INSTRUCTIONS = [
  "I lost the screen. Share the entire screen again and I'll catch up.",
  "I can't quite read this yet. Keep the sandbox in view for me.",
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

function normalized(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function actions(workflow: Workflow): Partial<Record<CanonicalPage, ActionGuide>> {
  const map: Partial<Record<CanonicalPage, ActionGuide>> = {};
  for (const step of workflow.steps) {
    const page = canonicalizePage(step.page);
    if (!page) continue;
    map[page] = {
      kind: "action",
      page,
      stepId: step.id,
      target: step.target,
      instruction: step.instruction,
      expectedPage: step.expectedPage,
    };
  }
  for (const step of workflow.offPath) {
    const page = canonicalizePage(step.page);
    if (!page || map[page]) continue;
    map[page] = {
      kind: "action",
      page,
      stepId: null,
      target: step.target,
      instruction: step.instruction,
      expectedPage: step.expectedPage,
    };
  }
  return map;
}

export function scriptedInstructions(workflow: Workflow): string[] {
  const planned = actions(workflow);
  const stalled = Object.values(planned).map((action) => stalledSharedInstruction(action.page, action.expectedPage));
  const distractions = workflow.steps.flatMap((step) => step.distractions?.map((item) => item.instruction) ?? []);
  const blockers = workflow.steps.flatMap((step) => step.blockers?.map((item) => item.instruction) ?? []);
  const confirms = workflow.steps.flatMap((step) => step.confirm ? [step.confirm.done, step.confirm.checking, step.confirm.missing] : []);
  const home = workflow.steps[0];
  const recovery = home ? [`This screen isn't in the workflow. Go back to ${home.page}.`] : [];
  return [
    ...Object.values(planned).map((action) => action.instruction),
    ...distractions,
    ...blockers,
    ...confirms,
    workflow.loadingInstruction,
    workflow.handoff.asked,
    workflow.handoff.stuck,
    workflow.handoff.unconfirmed,
    ...recovery,
    ...STATIC_INSTRUCTIONS,
    ...stalled,
    outsideWindowInstruction("popup"),
  ];
}

export function clickMatchesTarget(label: string, target: string): boolean {
  const clicked = normalized(label);
  const expected = normalized(target);
  if (!clicked || !expected) return false;
  return clicked.includes(expected) || (expected.includes(clicked) && clicked.length >= 4);
}

export function samePageDetour(workflow: Workflow, page: string | null, label: string): string | null {
  const canonical = canonicalizePage(page);
  const action = actionForPage(workflow, canonical);
  if (!canonical || !action || clickMatchesTarget(label, action.target)) return null;
  const step = workflow.steps.find((item) => item.page === canonical);
  const key = normalized(label);
  return step?.distractions?.find((item) => normalized(item.label) === key)?.instruction ?? null;
}

export function isSamePageDetour(workflow: Workflow, guide: Guide | null): guide is Extract<Guide, { kind: "clarify" }> {
  if (guide?.kind !== "clarify") return false;
  return workflow.steps.some((step) => step.distractions?.some((item) => item.instruction === guide.instruction));
}

export function actionForPage(workflow: Workflow, page: string | null): ActionGuide | null {
  const canonical = canonicalizePage(page);
  if (!canonical) return null;
  const planned = actions(workflow)[canonical];
  if (planned) return planned;
  const home = workflow.steps[0];
  if (!home || canonical === "Loading") return null;
  if (workflow.steps.some((step) => step.expectedPage === canonical || step.page === canonical)) return null;
  return {
    kind: "action",
    page: canonical,
    stepId: null,
    target: home.target,
    instruction: `This screen isn't in the workflow. Go back to ${home.page}.`,
    expectedPage: home.page,
  };
}

export function targetVisible(workflow: Workflow, page: string | null, elements: ScreenElement[]): boolean {
  const action = actionForPage(workflow, page);
  if (!action) return true;
  const target = normalized(action.target);
  return elements.some((element) => {
    const label = normalized(element.label);
    const disabled = /disabled|unavailable|hidden/i.test(element.state ?? "");
    const interactive = /button|link|card|tab|menuitem/i.test(element.role);
    return !disabled && interactive && (label === target || label.includes(target));
  });
}

function mentions(text: string, phrases: string[]): boolean {
  return phrases.some((phrase) => {
    const parts = phrase.toLowerCase().split(/\s+/).filter(Boolean).map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    if (parts.length === 0) return false;
    return new RegExp(`\\b${parts.join("\\s+")}\\b`, "i").test(text);
  });
}

export function connectedEvidence(summary: string, elements: ScreenElement[], confirm: ConnectionConfirm): boolean {
  if (mentions(summary, confirm.failure)) return false;
  return mentions(summary, confirm.success) && elements.some((element) => mentions(element.label, confirm.success));
}

export function guideForObservation(workflow: Workflow, input: {
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
  if (page === "Loading") return { kind: "wait", instruction: workflow.loadingInstruction };
  const last = workflow.steps.at(-1);
  if (last?.confirm && page === last.expectedPage) {
    if (input.review === "confirmed_connection") return { kind: "complete", instruction: last.confirm.done };
    if (input.review === "missing_connection") return { kind: "clarify", instruction: last.confirm.missing };
    return { kind: "wait", instruction: last.confirm.checking };
  }
  if (input.review === "checking_transition") {
    return { kind: "wait", instruction: "One second, I'm checking what that click did." };
  }
  if (input.review === "stalled_transition") {
    const action = actionForPage(workflow, page);
    return {
      kind: "wait",
      instruction: action
        ? `The window didn't change after ${action.target}. Make sure this is the sandbox you clicked.`
        : "The window didn't change. Make sure this is the sandbox you clicked.",
    };
  }
  if (input.review === "screen_lag") {
    return { kind: "clarify", instruction: "The shared screen is a beat behind. Stay on this page for a second." };
  }
  if (input.review === "stalled_shared_surface") {
    const action = actionForPage(workflow, page);
    return {
      kind: "clarify",
      instruction: action
        ? stalledSharedInstruction(action.page, action.expectedPage)
        : "The sandbox moved, but my view didn't. Share the sandbox window you clicked.",
    };
  }
  if (input.review === "checking_target") {
    return { kind: "wait", instruction: "One second, I'm making sure the next button is on screen." };
  }
  if (input.review === "missing_target") {
    return { kind: "clarify", instruction: "I can't see the next button. Give me a clear view of the page." };
  }
  if (input.review === "missing_connection") {
    return { kind: "clarify", instruction: last?.confirm?.missing ?? workflow.handoff.unconfirmed };
  }
  if (input.review === "checking_connection") {
    return { kind: "wait", instruction: last?.confirm?.checking ?? workflow.handoff.unconfirmed };
  }
  if (last && page === last.expectedPage && !workflow.steps.some((step) => step.page === page)) {
    return { kind: "complete", instruction: `You're all set. ${workflow.goal}` };
  }
  return actionForPage(workflow, page) ?? {
    kind: "clarify",
    instruction: "I'm not sure which page this is. Bring the sandbox window into view.",
  };
}
