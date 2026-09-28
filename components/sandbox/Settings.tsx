"use client";

import { useState } from "react";
import { emptyStory, type Story } from "@/components/sandbox/story";

export function Settings({
  story = emptyStory,
  onOpenIntegrations,
  onOpenApiKeys,
}: {
  story?: Story;
  onOpenIntegrations: () => void;
  onOpenApiKeys: () => void;
}) {
  const [tab, setTab] = useState<"general" | "team" | "billing">("general");
  return (
    <section className="flex flex-1 flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold text-slate-900">Settings</h1>
      <div className="flex flex-wrap gap-2 text-sm">
        <button type="button" onClick={() => setTab("general")} className={tabClass(tab === "general")}>General</button>
        <button type="button" onClick={onOpenIntegrations} className="min-h-11 cursor-pointer rounded-full bg-slate-100 px-4 text-slate-800 hover:bg-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800">
          Integrations
        </button>
        <button type="button" onClick={onOpenApiKeys} className="min-h-11 cursor-pointer rounded-full bg-slate-100 px-4 text-slate-800 hover:bg-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800">
          API Keys
        </button>
        <button type="button" onClick={() => setTab("team")} className={tabClass(tab === "team")}>Team</button>
        <button type="button" onClick={() => setTab("billing")} className={tabClass(tab === "billing")}>Billing</button>
      </div>
      <div className="flex max-w-xl items-center justify-between gap-4 rounded-xl border border-slate-900 bg-slate-900 p-5 text-white">
        <div>
          <p className="text-sm font-medium">{story.tokenSaved ? "Token already saved" : "Faster than Integrations"}</p>
          <p className="mt-1 text-sm text-slate-300">
            {story.tokenSaved
              ? "It is in API Keys. Repository access is still off."
              : "Paste a personal token. No GitHub approval screen."}
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenApiKeys}
          className="min-h-11 shrink-0 cursor-pointer rounded-md bg-white px-4 text-sm font-medium text-slate-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-300"
        >
          Create token
        </button>
      </div>
      {tab === "general" && (
        <form className="max-w-lg space-y-4 rounded-xl border border-slate-200 bg-white p-5">
          <label className="block text-sm text-slate-600">
            Workspace name
            <input readOnly value="Acme North" className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2" />
          </label>
          <label className="block text-sm text-slate-600">
            Time zone
            <input readOnly value="Pacific Time" className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2" />
          </label>
          <button type="button" className="min-h-11 cursor-pointer rounded-md bg-slate-900 px-4 text-sm text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800">
            Save changes
          </button>
        </form>
      )}
      {tab === "team" && (
        <div className="max-w-lg rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-700">
          <h2 className="text-lg font-semibold text-slate-900">Team</h2>
          <p className="mt-2">
            {story.invitesSent
              ? "Three more invites are waiting. The repository is still dark."
              : "Three seats are filled. Adding people does not connect a repository."}
          </p>
        </div>
      )}
      {tab === "billing" && (
        <div className="max-w-lg rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950">
          <h2 className="text-lg font-semibold">Billing</h2>
          <p className="mt-2">The card on file is fine. Payment does not turn on GitHub.</p>
          <button type="button" className="mt-4 min-h-11 cursor-pointer rounded-md bg-amber-900 px-4 text-sm text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800">
            Update payment method
          </button>
        </div>
      )}
    </section>
  );
}

function tabClass(selected: boolean): string {
  return selected
    ? "min-h-11 cursor-pointer rounded-full bg-slate-900 px-4 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
    : "min-h-11 cursor-pointer rounded-full bg-slate-100 px-4 text-slate-800 hover:bg-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800";
}
