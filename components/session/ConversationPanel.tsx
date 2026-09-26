"use client";

import { useCallback, useRef, useState } from "react";
import {
  DecisionPanel,
  EventLogPanel,
  MetricsSummary,
  RolloutPanel,
  ScreenStatePanel,
  WorldModelPanel,
} from "@/components/debug/DebugPanels";
import { AgentPresence } from "@/components/session/AgentPresence";
import { ScreenSharePreview } from "@/components/session/ScreenSharePreview";
import { SessionControls } from "@/components/session/SessionControls";
import { Transcript } from "@/components/session/Transcript";
import type { SessionSnapshot } from "@/lib/session/runtime";
import { SessionRuntime } from "@/lib/session/runtime";
import { createInitialWorldModel } from "@/lib/world/initial-state";
import { createMetrics } from "@/lib/session/metrics";

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

export function ConversationPanel() {
  const runtimeRef = useRef<SessionRuntime | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [snapshot, setSnapshot] = useState<SessionSnapshot>(initial);
  const [running, setRunning] = useState(false);

  function runtime(): SessionRuntime {
    if (!runtimeRef.current) {
      runtimeRef.current = new SessionRuntime(setSnapshot);
    }
    return runtimeRef.current;
  }

  const subscribeLevel = useCallback((listener: (level: number) => void) => {
    if (!runtimeRef.current) {
      runtimeRef.current = new SessionRuntime(setSnapshot);
    }
    return runtimeRef.current.subscribeLevel(listener);
  }, []);

  return (
    <div className="grid min-h-screen grid-cols-1 bg-slate-100 text-slate-900 lg:grid-cols-[minmax(0,1fr)_24rem]">
      <section className="flex flex-col gap-5 p-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium tracking-[0.16em] text-teal-800">SESSION</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">Connect GitHub</h1>
            <p className="mt-1 max-w-md text-sm leading-6 text-slate-600">Keep this window private. Share only the sandbox.</p>
          </div>
          <AgentPresence
            mode={
              !running
                ? "idle"
                : snapshot.hearing
                  ? "hearing"
                  : snapshot.world.agent.status
            }
            subscribeLevel={subscribeLevel}
          />
        </header>
        <SessionControls
          running={running}
          sharing={snapshot.screenSharing}
          onStart={() => {
            setRunning(true);
            runtime().start();
          }}
          onShare={() => {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            if (!video || !canvas) return;
            void runtime().shareScreen(video, canvas);
          }}
          onStop={() => {
            runtime().stop();
            setRunning(false);
          }}
          onReset={() => {
            runtime().reset();
            setRunning(false);
          }}
        />
        {snapshot.error && (
          <p className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">{snapshot.error}</p>
        )}
        <Transcript
          partial={snapshot.world.conversation.partialTranscript}
          latestUser={snapshot.world.conversation.latestUserUtterance}
          lastInstruction={snapshot.world.agent.lastInstruction}
        />
        <ScreenSharePreview active={snapshot.screenSharing} videoRef={videoRef} />
        <canvas ref={canvasRef} className="hidden" width={320} height={180} />
        {snapshot.ended && (
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <MetricsSummary metrics={snapshot.metrics} />
          </div>
        )}
      </section>
      <aside className="space-y-6 border-slate-200 bg-white p-5 lg:sticky lg:top-0 lg:h-screen lg:overflow-auto lg:border-l">
        <WorldModelPanel world={snapshot.world} lastEvent={snapshot.events.at(-1) ?? null} />
        <ScreenStatePanel world={snapshot.world} />
        <RolloutPanel rollout={snapshot.rollout} />
        <DecisionPanel world={snapshot.world} />
        <EventLogPanel events={snapshot.events} />
        {snapshot.logFile && <p className="text-xs leading-5 text-slate-600">Saved log: {snapshot.logFile}</p>}
      </aside>
    </div>
  );
}
