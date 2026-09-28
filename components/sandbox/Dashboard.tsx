"use client";

import { useEffect, useState } from "react";

export function Dashboard({
  onOpenSettings,
  onOpenApiKeys,
}: {
  onOpenSettings: () => void;
  onOpenApiKeys: () => void;
}) {
  const [time, setTime] = useState("--:--");
  const [invited, setInvited] = useState(false);
  useEffect(() => {
    const update = () => setTime(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, []);
  return (
    <section className="flex flex-1 flex-col gap-6 p-8">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-600">Pipeline health for this week</p>
        </div>
        <p className="text-sm text-slate-600">{time}</p>
      </header>
      <div className="grid grid-cols-3 gap-4">
        {[
          ["Open pipeline", "$1.2M"],
          ["Meetings", "18"],
          ["Win rate", "27%"],
        ].map(([label, value]) => (
          <article key={label} className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs uppercase tracking-wide text-slate-600">{label}</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
          </article>
        ))}
      </div>
      <div className="flex max-w-3xl flex-col gap-3 rounded-xl border border-slate-900 bg-slate-900 p-5 text-white">
        <p className="text-xs font-medium tracking-wide text-teal-200">RECOMMENDED</p>
        <h2 className="text-lg font-semibold">Finish setup with an API token</h2>
        <p className="text-sm text-slate-300">Most workspaces paste a token and skip the integration screens.</p>
        <button
          type="button"
          onClick={onOpenApiKeys}
          className="min-h-11 w-fit cursor-pointer rounded-md bg-white px-4 text-sm font-medium text-slate-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-300"
        >
          Create an API token
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setInvited(true)}
          className="min-h-11 cursor-pointer rounded-md bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
        >
          Invite team
        </button>
        <button
          type="button"
          onClick={onOpenSettings}
          className="min-h-11 cursor-pointer rounded-md border border-slate-300 bg-white px-4 text-sm text-slate-800 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
        >
          Open Settings
        </button>
      </div>
      {invited && (
        <p className="max-w-xl rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Invites sent. GitHub is still not connected.
        </p>
      )}
    </section>
  );
}
