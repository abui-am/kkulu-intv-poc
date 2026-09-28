"use client";

import { emptyStory, storyNotes, type Story } from "@/components/sandbox/story";

export function Sidebar({
  page,
  story = emptyStory,
  onNavigate,
}: {
  page: string;
  story?: Story;
  onNavigate: (page: "dashboard" | "settings") => void;
}) {
  return (
    <aside className="flex w-56 shrink-0 flex-col bg-slate-950 text-slate-200">
      <div className="border-b border-white/10 px-5 py-5">
        <p className="text-xs font-medium tracking-[0.18em] text-teal-300">NORTHSTAR</p>
        <p className="mt-1 text-sm text-slate-400">Revenue workspace</p>
      </div>
      <nav className="flex flex-col gap-1 p-3">
        {(
          [
            ["dashboard", "Dashboard"],
            ["settings", "Settings"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => onNavigate(id)}
            className={`min-h-11 cursor-pointer rounded-md px-3 py-2 text-left text-sm transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-300 ${
              page === id || (id === "settings" && page !== "dashboard")
                ? "bg-white/10 text-white"
                : "text-slate-300"
            }`}
          >
            {label}
          </button>
        ))}
      </nav>
      <div className="mt-auto space-y-1 px-5 py-4 text-xs text-slate-400">
        <p className="text-slate-500">Workspace · Acme North</p>
        {storyNotes(story).map((note) => <p key={note}>{note}</p>)}
      </div>
    </aside>
  );
}
