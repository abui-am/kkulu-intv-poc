"use client";

import { useEffect, useState } from "react";

export function Dashboard({ onOpenSettings }: { onOpenSettings: () => void }) {
  const [time, setTime] = useState("--:--");
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
      <button
        type="button"
        onClick={onOpenSettings}
        className="min-h-11 w-fit cursor-pointer rounded-md bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
      >
        Open Settings
      </button>
    </section>
  );
}
