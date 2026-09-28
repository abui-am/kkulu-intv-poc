"use client";

import { useEffect, useState, type RefObject } from "react";
import { ApiKeys } from "@/components/sandbox/ApiKeys";
import { Dashboard } from "@/components/sandbox/Dashboard";
import { GithubAuthorization } from "@/components/sandbox/GithubAuthorization";
import { GithubIntegration } from "@/components/sandbox/GithubIntegration";
import { Integrations } from "@/components/sandbox/Integrations";
import { Settings } from "@/components/sandbox/Settings";
import { Sidebar } from "@/components/sandbox/Sidebar";

type SandboxPage =
  | "dashboard"
  | "settings"
  | "loading"
  | "integrations"
  | "github"
  | "authorize"
  | "connected"
  | "api-keys"
  | "ambiguous";

const PAGE_LABELS: Record<SandboxPage, string> = {
  dashboard: "Dashboard",
  settings: "Settings",
  loading: "Loading",
  integrations: "Integrations",
  github: "GitHub Integration",
  authorize: "GitHub Authorization",
  connected: "GitHub Connected",
  "api-keys": "API Keys",
  ambiguous: "Unknown",
};

export function SandboxApp({
  productRef,
  onInteraction,
  onPage,
}: {
  productRef: RefObject<HTMLDivElement | null>;
  onInteraction: (label: string, at: number) => void;
  onPage: (page: string, at: number) => void;
}) {
  const [page, setPage] = useState<SandboxPage>("dashboard");

  useEffect(() => {
    onPage(PAGE_LABELS[page], Date.now());
  }, [onPage, page]);

  function reportClick(event: React.MouseEvent<HTMLDivElement>): void {
    const button = (event.target as HTMLElement).closest("button");
    if (!button || !event.currentTarget.contains(button)) return;
    const label = button.textContent?.trim().replace(/\s+/g, " ").slice(0, 80);
    if (!label) return;
    onInteraction(label, Date.now());
  }

  function openIntegrations() {
    setPage("loading");
    window.setTimeout(() => setPage("integrations"), 1000);
  }

  return (
    <div ref={productRef} className="flex min-h-screen min-w-0 flex-1 bg-slate-100 text-slate-900" onClick={reportClick}>
      <Sidebar
        page={page === "dashboard" ? "dashboard" : "settings"}
        onNavigate={(next) => setPage(next === "dashboard" ? "dashboard" : "settings")}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        {page === "dashboard" && <Dashboard onOpenSettings={() => setPage("settings")} />}
        {page === "settings" && (
          <Settings onOpenIntegrations={openIntegrations} onOpenApiKeys={() => setPage("api-keys")} />
        )}
        {page === "loading" && (
          <section className="flex flex-1 items-center justify-center">
            <p className="text-lg text-slate-600">Loading integrations…</p>
          </section>
        )}
        {page === "integrations" && <Integrations onSelectGithub={() => setPage("github")} />}
        {page === "github" && <GithubIntegration onConnect={() => setPage("authorize")} />}
        {page === "authorize" && <GithubAuthorization onAuthorize={() => setPage("connected")} />}
        {page === "connected" && (
          <section className="flex flex-1 flex-col items-start justify-center gap-3 p-8">
            <p className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-800">Success</p>
            <h1 className="text-4xl font-semibold text-emerald-800">GitHub Connected</h1>
            <p className="text-slate-600">Northstar can now see repository metadata for Acme North.</p>
          </section>
        )}
        {page === "api-keys" && <ApiKeys />}
        {page === "ambiguous" && (
          <section className="relative flex flex-1 items-center justify-center overflow-hidden bg-slate-200">
            <div className="absolute inset-8 rounded-3xl bg-white/30" />
            <div className="absolute left-16 top-20 h-24 w-64 rounded-xl bg-slate-400/40" />
            <p className="relative text-slate-400">Status updating</p>
          </section>
        )}
        <footer className="relative z-40 flex items-center justify-between border-t border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
          <span>Demo controls</span>
          <span className="flex gap-2">
            <button type="button" className="min-h-11 cursor-pointer rounded-md border border-slate-300 px-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800" onClick={() => setPage("ambiguous")}>
              Unclear screen
            </button>
            <button type="button" className="min-h-11 cursor-pointer rounded-md border border-slate-300 px-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800" onClick={() => setPage("dashboard")}>
              Reset
            </button>
          </span>
        </footer>
      </div>
    </div>
  );
}
