"use client";

import { ApiKeys } from "@/components/sandbox/ApiKeys";
import { Dashboard } from "@/components/sandbox/Dashboard";
import { GithubAuthorization } from "@/components/sandbox/GithubAuthorization";
import { GithubIntegration } from "@/components/sandbox/GithubIntegration";
import { Integrations } from "@/components/sandbox/Integrations";
import { Settings } from "@/components/sandbox/Settings";
import { useSandbox } from "@/components/sandbox/sandbox-context";

export function DashboardScreen() {
  const { story, mark, visit } = useSandbox();
  return (
    <Dashboard
      story={story}
      onOpenSettings={() => visit("settings")}
      onOpenApiKeys={() => visit("api-keys")}
      onInvite={() => mark("invitesSent")}
    />
  );
}

export function SettingsScreen() {
  const { story, visit } = useSandbox();
  return <Settings story={story} onOpenIntegrations={() => visit("integrations")} onOpenApiKeys={() => visit("api-keys")} />;
}

export function IntegrationsScreen() {
  const { story, mark, visit } = useSandbox();
  return (
    <Integrations
      story={story}
      onSelectGithub={() => visit("github")}
      onSlack={() => mark("slackBlocked")}
      onHubspot={() => mark("hubspotRequested")}
    />
  );
}

export function GithubScreen() {
  const { story, mark, visit } = useSandbox();
  return <GithubIntegration story={story} onConnect={() => visit("authorize")} onRejectInstall={() => mark("installRejected")} />;
}

export function AuthorizeScreen() {
  const { story, mark, visit } = useSandbox();
  return (
    <GithubAuthorization
      story={story}
      onAuthorize={() => {
        mark("githubConnected");
        visit("connected");
      }}
      onDeny={() => mark("accessDenied")}
    />
  );
}

export function ConnectedScreen() {
  const { story } = useSandbox();
  return (
    <section className="flex flex-1 flex-col items-start justify-center gap-3 p-8">
      <p className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-800">Success</p>
      <h1 className="text-4xl font-semibold text-emerald-800">GitHub Connected</h1>
      <p className="text-slate-600">Northstar can now see repository metadata for Acme North.</p>
      {story.tokenSaved && <p className="text-sm text-slate-600">The API token is still unused.</p>}
      {story.slackBlocked && <p className="text-sm text-slate-600">Slack stayed blocked on the paid seat.</p>}
      {story.invitesSent && <p className="text-sm text-slate-600">The team invites are already out.</p>}
    </section>
  );
}

export function ApiKeysScreen() {
  const { story, mark } = useSandbox();
  return <ApiKeys story={story} onSaveToken={() => mark("tokenSaved")} />;
}

export function UnclearScreen() {
  return (
    <section className="relative flex flex-1 items-center justify-center overflow-hidden bg-slate-200">
      <div className="absolute inset-8 rounded-3xl bg-white/30" />
      <div className="absolute left-16 top-20 h-24 w-64 rounded-xl bg-slate-400/40" />
      <p className="relative text-slate-400">Status updating</p>
    </section>
  );
}
