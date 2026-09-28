import { standardHandoff, type Workflow } from "@/lib/workflow/model";

export const connectGithub: Workflow = {
  id: "connect-github",
  goal: "Connect GitHub to the SaaS application.",
  successLabel: "GitHub is connected",
  loadingInstruction: "Integrations is still loading. Give it a moment.",
  handoff: standardHandoff,
  steps: [
    {
      id: "openSettings",
      page: "Dashboard",
      label: "Open Settings",
      target: "Open Settings",
      expectedPage: "Settings",
      instruction: "You're on the dashboard. Hit Open Settings and we'll go from there.",
    },
    {
      id: "openIntegrations",
      page: "Settings",
      label: "Open Integrations",
      target: "Integrations",
      expectedPage: "Integrations",
      instruction: "Good, Settings is open. Click Integrations next.",
      distractions: [
        {
          label: "Billing",
          instruction: "That's Billing. Payment doesn't connect GitHub. Click Integrations.",
        },
        {
          label: "Update payment method",
          instruction: "That's the payment method. It still doesn't connect GitHub. Click Integrations.",
        },
      ],
    },
    {
      id: "selectGithub",
      page: "Integrations",
      label: "Select GitHub",
      target: "GitHub",
      expectedPage: "GitHub Integration",
      instruction: "Here's Integrations. Select the GitHub card.",
      blockers: [
        {
          label: "Slack",
          summary: "Slack is blocked because a paid seat is required. This workflow cannot grant it.",
          instruction: "Slack needs a paid seat, and I can't grant that. I'll flag it for someone on the team.",
        },
      ],
    },
    {
      id: "authorizeGithub",
      page: "GitHub Integration",
      label: "Connect GitHub",
      target: "Connect GitHub",
      expectedPage: "GitHub Authorization",
      instruction: "This is the GitHub integration. Click Connect GitHub when you're ready.",
    },
    {
      id: "verifyConnection",
      page: "GitHub Authorization",
      label: "Authorize",
      target: "Authorize",
      expectedPage: "GitHub Connected",
      instruction: "Take a look at the permissions, then click Authorize if that feels right.",
      confirm: {
        done: "You're all set. GitHub is connected.",
        checking: "Hang on, I'm checking that GitHub actually connected.",
        missing: "I don't see the GitHub success message yet. Leave that page up so I can check.",
        success: ["success", "github connected", "connected to github"],
        failure: ["not connected", "failed", "error", "unsuccessful", "disconnected"],
      },
    },
  ],
  offPath: [
    {
      page: "API Keys",
      target: "Settings",
      expectedPage: "Settings",
      instruction: "This is API Keys, a little off the path. Click Settings in the sidebar and we'll get back to GitHub.",
    },
  ],
};
