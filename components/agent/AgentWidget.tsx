"use client";

import { useState, type ReactNode } from "react";
import { InstructionSettings } from "@/components/agent/InstructionSettings";
import { GuidePanel } from "@/components/session/GuidePanel";
import type { MirroredSession } from "@/lib/session/channel";
import type { Workflow } from "@/lib/workflow/model";
import { cardCopy, cardPhase, type PrimaryAction } from "@/lib/session/closing";
import type { AgentStatus } from "@/lib/world/types";

const labels: Record<AgentStatus, string> = {
  idle: "Idle",
  listening: "Listening",
  thinking: "Thinking",
  speaking: "Speaking",
};

const primaryLabels: Record<PrimaryAction, string> = {
  start: "Start",
  stop: "Stop",
  done: "Done",
  continue: "Continue",
  again: "Walk through again",
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
  onInstructionsSaved,
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
  onInstructionsSaved: (workflow: Workflow) => void;
  allowShare: boolean;
  debug: ReactNode;
}) {
  const [debugOpen, setDebugOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const phase = session
    ? cardPhase({
      running,
      ended: session.ended,
      goalStatus: session.goalStatus,
      guideKind: session.guide?.kind ?? null,
    })
    : "welcome";
  const copy = cardCopy({
    phase,
    currentStep: session?.currentStep ?? "openSettings",
    instruction: session?.guide?.instruction ?? session?.instruction ?? null,
    stepLabel: session?.stepLabel,
    successLabel: session?.successLabel,
    handoff: session?.handoff,
  });
  const activity = session?.status === "speaking" || session?.status === "thinking" ? session.status : "listening";
  const mode = phase === "live"
    ? (noticing ? "listening" : session?.status === "speaking" ? "speaking" : session?.status === "thinking" ? "thinking" : session?.hearing ? "hearing" : "listening")
    : "idle";
  const label = phase === "escalated"
    ? "Flagged"
    : phase === "done" || phase === "finished"
    ? "Done"
    : phase === "paused"
      ? "Paused"
      : phase === "live"
        ? (noticing ? "Noticed" : labels[activity])
        : "Idle";

  function onPrimary() {
    if (copy.primary === "stop" || copy.primary === "done") onStop();
    else if (copy.primary === "again") {
      onReset();
      onStart();
    } else onStart();
  }

  return (
    <aside className={`fixed right-5 bottom-5 z-50 rounded-2xl bg-slate-950 p-3 text-white shadow-2xl ${manualOpen ? "w-[28rem]" : "w-80"}`} aria-label="Agent">
      <p className="text-[10px] font-medium tracking-[0.14em] text-teal-200">AGENT</p>
      <div className="mt-2 flex items-center gap-2" role="status" aria-live="polite">
        {noticing && phase === "live" ? (
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
        <p className="text-xs font-medium text-teal-100">{label}</p>
      </div>
      {copy.heading ? (
        <div className="mt-3">
          <GuidePanel heading={copy.heading} body={copy.body} compact />
        </div>
      ) : (
        <p className="mt-2 text-sm leading-5">{copy.body}</p>
      )}
      {error && phase === "live" && <p className="mt-3 text-sm leading-5 text-amber-200">{error}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onPrimary}
          className={copy.primary === "start" || copy.primary === "continue" || copy.primary === "again" || copy.primary === "done"
            ? "min-h-11 cursor-pointer rounded-md bg-white px-3 text-sm font-medium text-slate-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-300"
            : "min-h-11 cursor-pointer rounded-md bg-white/10 px-3 text-sm font-medium text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-300"}
        >
          {primaryLabels[copy.primary]}
        </button>
        {allowShare && phase === "live" && !sharing && (
          <button type="button" onClick={onShare} className="min-h-11 cursor-pointer rounded-md bg-white/10 px-3 text-sm font-medium text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-300">
            Share entire screen
          </button>
        )}
      </div>
      <div className="mt-2 flex items-center justify-between gap-3">
        {phase === "paused" || phase === "welcome" || phase === "live" ? (
          <button type="button" onClick={onReset} className="min-h-11 cursor-pointer text-xs text-slate-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-300">
            {phase === "paused" ? "Start over" : "Reset session"}
          </button>
        ) : <span />}
        <span className="flex gap-3">
          <button
            type="button"
            aria-expanded={manualOpen}
            onClick={() => setManualOpen((open) => !open)}
            className="min-h-11 cursor-pointer text-xs text-slate-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-300"
          >
            {manualOpen ? "Hide instructions" : "Instructions"}
          </button>
          <button
            type="button"
            aria-expanded={debugOpen}
            onClick={() => setDebugOpen((open) => !open)}
            className="min-h-11 cursor-pointer text-xs text-slate-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-300"
          >
            {debugOpen ? "Hide debug" : "Debug"}
          </button>
        </span>
      </div>
      {manualOpen && (
        <div className="mt-2 max-h-[50vh] overflow-auto rounded-xl bg-white p-3">
          <InstructionSettings onSaved={onInstructionsSaved} />
        </div>
      )}
      {debugOpen && (
        <div className="mt-2 max-h-[50vh] space-y-3 overflow-auto rounded-xl bg-white p-3 text-slate-900">
          {debug}
        </div>
      )}
    </aside>
  );
}
