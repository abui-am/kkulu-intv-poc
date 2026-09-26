"use client";

import { useCallback, useRef, useState } from "react";
import {
  DecisionPanel,
  EventLogPanel,
  RolloutPanel,
  ScreenStatePanel,
  WorldModelPanel,
} from "@/components/debug/DebugPanels";
import { AgentPresence } from "@/components/session/AgentPresence";
import type { SessionSnapshot } from "@/lib/session/runtime";
import { SessionRuntime } from "@/lib/session/runtime";
import { createMetrics } from "@/lib/session/metrics";
import { createInitialWorldModel } from "@/lib/world/initial-state";

const initial: SessionSnapshot = {
  world: createInitialWorldModel("pending"),
  events: [],
  metrics: createMetrics(0),
  recentTurns: [],
  error: null,
  screenSharing: false,
  hearing: false,
  ended: false,
  logFile: null,
  rollout: null,
};

export function AgentWidget() {
  const runtimeRef = useRef<SessionRuntime | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [snapshot, setSnapshot] = useState<SessionSnapshot>(initial);
  const [running, setRunning] = useState(false);
  const [traceOpen, setTraceOpen] = useState(false);
  const mode = !running ? "idle" : snapshot.hearing ? "hearing" : snapshot.world.agent.status;
  const line =
    mode === "hearing"
      ? snapshot.world.conversation.partialTranscript || "Hearing you"
      : mode === "thinking"
        ? "Thinking"
        : snapshot.world.agent.lastInstruction || (mode === "listening" ? "Listening" : "Talk to me");

  function runtime(): SessionRuntime {
    runtimeRef.current ??= new SessionRuntime(setSnapshot);
    return runtimeRef.current;
  }

  const subscribeLevel = useCallback((listener: (level: number) => void) => {
    runtimeRef.current ??= new SessionRuntime(setSnapshot);
    return runtimeRef.current.subscribeLevel(listener);
  }, []);

  return (
    <>
      <div className="fixed right-5 bottom-24 z-30 flex items-end gap-3">
        <div className="w-64 rounded-2xl bg-slate-950 p-3 text-white shadow-lg">
          <p className="text-[10px] font-medium tracking-[0.14em] text-teal-200">AGENT</p>
          <p className="mt-1 min-h-10 text-sm leading-5">{line}</p>
          {snapshot.error && <p className="mt-2 text-xs leading-5 text-amber-200">{snapshot.error}</p>}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              className="min-h-11 flex-1 cursor-pointer rounded-md bg-white/10 px-2 text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-300"
              onClick={() => {
                const video = videoRef.current;
                const canvas = canvasRef.current;
                if (!video || !canvas) return;
                if (!running) {
                  setRunning(true);
                  runtime().start();
                }
                void runtime().shareScreen(video, canvas);
              }}
            >
              {snapshot.screenSharing ? "Seeing this window" : "Let me see this window"}
            </button>
            <button
              type="button"
              className="min-h-11 cursor-pointer rounded-md px-2 text-xs text-slate-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-300"
              onClick={() => setTraceOpen((open) => !open)}
            >
              {traceOpen ? "Hide" : "Trace"}
            </button>
          </div>
        </div>
        <AgentPresence
          mode={mode}
          subscribeLevel={subscribeLevel}
          activateLabel={running ? `Agent is ${mode}. Stop` : "Start the agent"}
          onActivate={() => {
            if (running) {
              runtime().stop();
              setRunning(false);
              return;
            }
            setRunning(true);
            runtime().start();
          }}
        />
      </div>
      {traceOpen && (
        <aside className="fixed top-0 right-0 z-20 h-screen w-[24rem] max-w-full overflow-auto border-l border-slate-200 bg-white p-5 pb-28 text-slate-900 shadow-xl">
          <WorldModelPanel world={snapshot.world} lastEvent={snapshot.events.at(-1) ?? null} />
          <div className="mt-6 space-y-6">
            <RolloutPanel rollout={snapshot.rollout} />
            <ScreenStatePanel world={snapshot.world} />
            <DecisionPanel world={snapshot.world} />
            <EventLogPanel events={snapshot.events} />
          </div>
        </aside>
      )}
      <video ref={videoRef} className="hidden" autoPlay muted playsInline />
      <canvas ref={canvasRef} className="hidden" width={320} height={180} />
    </>
  );
}
