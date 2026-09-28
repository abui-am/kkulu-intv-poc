import { connectGithub } from "@/lib/workflow/connect-github";
import { standardHandoff, type ConnectionConfirm, type Workflow, type WorkflowBlocker } from "@/lib/workflow/model";

export const MANUAL_PAGES = [
  "Dashboard",
  "Settings",
  "Integrations",
  "GitHub Integration",
  "GitHub Authorization",
  "API Keys",
] as const;

export const DESTINATION_PAGES = [...MANUAL_PAGES, "GitHub Connected"] as const;

export type ManualPage = (typeof MANUAL_PAGES)[number];
export type DestinationPage = (typeof DESTINATION_PAGES)[number];

export type ManualStepInput = {
  page: ManualPage;
  instruction: string;
  target: string;
  expectedPage: DestinationPage;
  blockers?: WorkflowBlocker[];
  confirm?: ConnectionConfirm;
};

export const DEFAULT_MANUAL = `Connect GitHub

The user starts on the dashboard. You're on the dashboard. Hit Open Settings and we'll go from there.

When Settings is open, click Integrations next.

On Integrations, select the GitHub card.

On the GitHub integration page, click Connect GitHub when you're ready.

On the authorization page, look at the permissions, then click Authorize if that feels right.

If they land on API Keys, that is off the path. Send them back to Settings in the sidebar.
`;

export function readManual(): string {
  return DEFAULT_MANUAL;
}

export function compileWorkflow(text: string, steps: ManualStepInput[]): Workflow | null {
  const next = text.trim();
  const usable = steps.filter((step) => (
    MANUAL_PAGES.includes(step.page)
    && DESTINATION_PAGES.includes(step.expectedPage)
    && step.instruction.trim()
    && step.target.trim()
  ));
  if (!next || usable.length === 0) return null;
  const seen = new Set<ManualPage>();
  const ordered = usable.filter((step) => {
    if (seen.has(step.page)) return false;
    seen.add(step.page);
    return true;
  });
  const goal = next.split("\n").map((line) => line.trim()).find(Boolean)?.slice(0, 140) ?? connectGithub.goal;
  return {
    id: "manual",
    goal,
    successLabel: goal,
    loadingInstruction: "This screen is still loading. Give it a moment.",
    handoff: standardHandoff,
    steps: ordered.map((step, index) => ({
      id: `step-${index + 1}`,
      page: step.page,
      label: step.target.trim(),
      target: step.target.trim(),
      expectedPage: step.expectedPage,
      instruction: step.instruction.trim(),
      ...(step.blockers?.length ? { blockers: step.blockers } : {}),
      ...(step.confirm ? { confirm: step.confirm } : {}),
    })),
    offPath: [],
  };
}
