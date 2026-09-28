import { clickMatchesTarget } from "@/lib/workflow/guide";
import { standardHandoff, stepById, stepLabel, type Escalation, type Workflow, type WorkflowBlocker } from "@/lib/workflow/model";

export const STUCK_AFTER_DEVIATIONS = standardHandoff.stuckAfter;
import { canonicalizePage } from "@/lib/workflow/pages";

const PERSON_REQUEST = /\b(human|real person|someone on the team|talk to (a )?(person|someone)|escalate|customer success|need a person)\b/i;

export function askedForPerson(utterance: string | null): boolean {
  if (!utterance) return false;
  return PERSON_REQUEST.test(utterance);
}

export function blockerFor(workflow: Workflow, page: string | null, label: string): WorkflowBlocker | null {
  const canonical = canonicalizePage(page);
  const step = workflow.steps.find((item) => item.page === canonical);
  if (!step?.blockers?.length || clickMatchesTarget(label, step.target)) return null;
  return step.blockers.find((item) => clickMatchesTarget(label, item.label)) ?? null;
}

export function holdsEscalation(escalation: Escalation, workflow: Workflow, currentStep: string, nextPage: string | null): boolean {
  if (escalation.reason !== "blocker") return true;
  const step = stepById(workflow, currentStep);
  return canonicalizePage(nextPage) !== step?.expectedPage;
}

function handoff(workflow: Workflow, stepId: string, page: string | null, detail: string): string {
  return `${detail} Page: ${page ?? "unknown"}. Step: ${stepLabel(workflow, stepId)}.`;
}

export function escalationForBlocker(workflow: Workflow, page: string | null, stepId: string, blocker: WorkflowBlocker): Escalation {
  return {
    reason: "blocker",
    page: canonicalizePage(page),
    stepId,
    summary: handoff(workflow, stepId, canonicalizePage(page), blocker.summary),
    instruction: blocker.instruction,
  };
}

export function escalationForAsk(workflow: Workflow, page: string | null, stepId: string, utterance: string): Escalation {
  const said = utterance.trim().replace(/\s+/g, " ").slice(0, 140);
  return {
    reason: "asked",
    page: canonicalizePage(page),
    stepId,
    summary: handoff(workflow, stepId, canonicalizePage(page), `The user asked for a person: "${said}".`),
    instruction: workflow.handoff.asked,
  };
}

export function escalationForStuck(workflow: Workflow, page: string | null, stepId: string, expected: string, observed: string): Escalation {
  return {
    reason: "stuck",
    page: canonicalizePage(page),
    stepId,
    summary: handoff(workflow, stepId, canonicalizePage(page), `The screen missed ${expected} twice. Last screen: ${observed}.`),
    instruction: workflow.handoff.stuck,
  };
}

export function escalationForUnconfirmed(workflow: Workflow, page: string | null, stepId: string): Escalation {
  return {
    reason: "unconfirmed",
    page: canonicalizePage(page),
    stepId,
    summary: handoff(workflow, stepId, canonicalizePage(page), "The connection check failed. The success message was not on the screen."),
    instruction: workflow.handoff.unconfirmed,
  };
}
