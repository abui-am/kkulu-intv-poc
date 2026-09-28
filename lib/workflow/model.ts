export type WorkflowDistraction = {
  label: string;
  instruction: string;
};

export type WorkflowBlocker = {
  label: string;
  summary: string;
  instruction: string;
};

export type ConnectionConfirm = {
  done: string;
  checking: string;
  missing: string;
  /** Phrases that count as the step being done, matched on the screen summary and an element. */
  success: string[];
  /** Phrases that mean the step is not done, even if a success phrase is also visible. */
  failure: string[];
};

export type Handoff = {
  stuckAfter: number;
  asked: string;
  stuck: string;
  unconfirmed: string;
};

export const standardHandoff: Handoff = {
  stuckAfter: 2,
  asked: "I'll flag this for someone on the team and pass along where you are.",
  stuck: "We've missed the expected screen twice. I'll flag it for someone on the team.",
  unconfirmed: "I still can't see that this connected. I'll flag it for someone on the team.",
};

export type WorkflowStep = {
  id: string;
  page: string;
  label: string;
  target: string;
  expectedPage: string;
  instruction: string;
  distractions?: WorkflowDistraction[];
  blockers?: WorkflowBlocker[];
  /** Landing on expectedPage waits for this confirmation before the step counts. */
  confirm?: ConnectionConfirm;
};

export type OffPathStep = {
  page: string;
  target: string;
  expectedPage: string;
  instruction: string;
};

export type EscalationReason = "blocker" | "stuck" | "unconfirmed" | "asked";

export type Escalation = {
  reason: EscalationReason;
  page: string | null;
  stepId: string;
  summary: string;
  instruction: string;
};

export type Workflow = {
  id: string;
  goal: string;
  successLabel: string;
  loadingInstruction: string;
  handoff: Handoff;
  steps: WorkflowStep[];
  offPath: OffPathStep[];
};

export function stepById(workflow: Workflow, id: string): WorkflowStep | undefined {
  return workflow.steps.find((step) => step.id === id);
}

export function stepOrder(workflow: Workflow): string[] {
  return workflow.steps.map((step) => step.id);
}

export function stepLabel(workflow: Workflow, id: string): string {
  return stepById(workflow, id)?.label ?? id;
}

export function expectedPage(workflow: Workflow, id: string): string | null {
  return stepById(workflow, id)?.expectedPage ?? null;
}

export function isTerminal(workflow: Workflow, id: string): boolean {
  return workflow.steps.at(-1)?.id === id;
}

export function nextStepId(workflow: Workflow, id: string): string | null {
  const index = workflow.steps.findIndex((step) => step.id === id);
  if (index < 0 || index >= workflow.steps.length - 1) return null;
  return workflow.steps[index + 1].id;
}

export function standingPage(workflow: Workflow, id: string): string | null {
  return stepById(workflow, id)?.page ?? null;
}

export function awaitsConnection(workflow: Workflow, page: string | null): boolean {
  const last = workflow.steps.at(-1);
  return Boolean(last?.confirm) && page === last?.expectedPage;
}
