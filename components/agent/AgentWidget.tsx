"use client";

import { useState, type ReactNode } from "react";
import { GuidePanel } from "@/components/session/GuidePanel";
import type { MirroredSession } from "@/lib/session/channel";
import type { AgentStatus } from "@/lib/world/types";

const labels: Record<AgentStatus, string> = {
  idle: "Idle",
  listening: "Listening",
  thinking: "Thinking",
  speaking: "Speaking",
};

export function AgentWidget({
  session,
  noticing,
  running,
  sharing,
  error,
  onStart,
  onStop,
  onShare,
  onReset,
  allowShare,
  debug,
}: {
  session: MirroredSession | null;
  noticing: boolean;
  running: boolean;
  sharing: boolean;
  error: string | null;
  onStart: () => void;
  onStop: () => void;
  onShare: () => void;
  onReset: () => void;
  allowShare: boolean;
  debug: ReactNode;
}) {
  const [debugOpen, setDebugOpen] = useState(false);
  const active = Boolean(session?.active);
  const mode = !active
    ? "idle"
    : session?.status === "speaking"
      ? "speaking"
      : session?.status === "thinking"
        ? "thinking"
        : session?.hearing
          ? "hearing"
          : "listening";
  const label = active ? labels[session?.status === "speaking" || session?.status === "thinking" ? session.status : "listening"] : "Idle";

  return (
    <aside className="fixed right-5 bottom-5 z-50 w-80 rounded-2xl bg-slate-950 p-3 text-white shadow-2xl" aria-label="Agent">
      <p className="text-[10px] font-medium tracking-[0.14em] text-teal-200">AGENT</p>
      <div className="mt-2 flex items-center gap-2" role="status" aria-live="polite">
        {noticing ? (
          <span className="agent-dots" aria-label="Noticed the click">
            <span />
            <span />
            <span />
          </span>
        ) : (
          <span className={`agent-mark agent-mark-${mode}`} aria-hidden="true">
            <span className="agent-mark-core" />
          </span>
        )}
        <p className="text-xs font-medium text-teal-100">{noticing ? "Noticed" : label}</p>
      </div>
      {active && session ? (
        <div className="mt-3">
          <GuidePanel
            guide={session.guide}
            verifiedCount={session.verifiedCount}
            skippedCount={session.skippedCount}
            compact
          />
        </div>
      ) : (
        <p className="mt-2 text-sm leading-5">Start the session to begin.</p>
      )}
      {error && <p className="mt-3 text-sm leading-5 text-amber-200">{error}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        {!running ? (
          <button type="button" onClick={onStart} className="min-h-11 cursor-pointer rounded-md bg-white px-3 text-sm font-medium text-slate-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-300">
            Start
          </button>
        ) : (
          <button type="button" onClick={onStop} className="min-h-11 cursor-pointer rounded-md bg-white/10 px-3 text-sm font-medium text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-300">
            Stop
          </button>
        )}
        {allowShare && running && !sharing && (
          <button type="button" onClick={onShare} className="min-h-11 cursor-pointer rounded-md bg-white/10 px-3 text-sm font-medium text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-300">
            Share entire screen
          </button>
        )}
      </div>
      <div className="mt-2 flex items-center justify-between gap-3">
        <button type="button" onClick={onReset} className="min-h-11 cursor-pointer text-xs text-slate-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-300">
          Reset session
        </button>
        <button
          type="button"
          aria-expanded={debugOpen}
          onClick={() => setDebugOpen((open) => !open)}
          className="min-h-11 cursor-pointer text-xs text-slate-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-300"
        >
          {debugOpen ? "Hide debug" : "Debug"}
        </button>
      </div>
      {debugOpen && (
        <div className="mt-2 max-h-[50vh] space-y-3 overflow-auto rounded-xl bg-white p-3 text-slate-900">
          {debug}
        </div>
      )}
    </aside>
  );
}
