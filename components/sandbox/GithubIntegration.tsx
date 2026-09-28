"use client";

import { useState } from "react";

export function GithubIntegration({ onConnect }: { onConnect: () => void }) {
  const [rejected, setRejected] = useState(false);
  return (
    <section className="flex flex-1 flex-col gap-6 p-8">
      <p className="text-xs font-medium tracking-wide text-slate-600">INTEGRATIONS</p>
      <h1 className="text-2xl font-semibold text-slate-900">GitHub Integration</h1>
      <p className="max-w-lg text-sm text-slate-600">
        Northstar can read repository metadata after you approve access. Your GitHub password is never shared.
      </p>
      <div className="flex max-w-xl flex-col gap-3 rounded-xl border border-slate-900 bg-slate-900 p-5 text-white">
        <h2 className="text-lg font-semibold">Install on every repository</h2>
        <p className="text-sm text-slate-300">Includes private code, write access, and admin on the org.</p>
        <button
          type="button"
          onClick={() => setRejected(true)}
          className="min-h-11 w-fit cursor-pointer rounded-md bg-white px-4 text-sm font-medium text-slate-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-300"
        >
          Install on all repositories
        </button>
      </div>
      {rejected && (
        <p className="max-w-xl rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          That install was rejected. Northstar will not take write access to every repository.
        </p>
      )}
      <button
        type="button"
        onClick={onConnect}
        className="min-h-11 w-fit cursor-pointer rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
      >
        Connect GitHub
      </button>
    </section>
  );
}
