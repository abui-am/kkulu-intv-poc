export const githubWorkflow = {
  openSettings: {
    expectedScreen: "Settings",
    next: "openIntegrations",
  },
  openIntegrations: {
    expectedScreen: "Integrations",
    next: "selectGithub",
  },
  selectGithub: {
    expectedScreen: "GitHub Integration",
    next: "authorizeGithub",
  },
  authorizeGithub: {
    expectedScreen: "GitHub Authorization",
    next: "verifyConnection",
  },
  verifyConnection: {
    expectedScreen: "GitHub Connected",
    terminal: true,
  },
} as const;

export type WorkflowStepId = keyof typeof githubWorkflow;

export const workflowStepOrder: WorkflowStepId[] = [
  "openSettings",
  "openIntegrations",
  "selectGithub",
  "authorizeGithub",
  "verifyConnection",
];

export const workflowStepLabels: Record<WorkflowStepId, string> = {
  openSettings: "Open Settings",
  openIntegrations: "Open Integrations",
  selectGithub: "Select GitHub",
  authorizeGithub: "Authorize",
  verifyConnection: "Verify",
};

export function isTerminalStep(stepId: WorkflowStepId): boolean {
  return "terminal" in githubWorkflow[stepId];
}

export function nextStep(stepId: WorkflowStepId): WorkflowStepId | null {
  const step = githubWorkflow[stepId];
  if (!("next" in step)) return null;
  return step.next;
}

export function previousExpectedScreen(stepId: WorkflowStepId): string | null {
  switch (stepId) {
    case "openSettings":
      return "Dashboard";
    case "openIntegrations":
      return "Settings";
    case "selectGithub":
      return "Integrations";
    case "authorizeGithub":
      return "GitHub Integration";
    case "verifyConnection":
      return "GitHub Authorization";
    default:
      return null;
  }
}
