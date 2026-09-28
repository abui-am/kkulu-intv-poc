"use client";

import { useEffect, useState } from "react";
import {
  DecisionPanel,
  EventLogPanel,
  MetricsSummary,
  ReflectionPanel,
  RolloutPanel,
  ScreenStatePanel,
  WorldModelPanel,
} from "@/components/debug/DebugPanels";
import { Transcript } from "@/components/session/Transcript";
import { DEBUG_CHANNEL, type DebugChannelMessage } from "@/lib/session/channel";
import type { SessionSnapshot } from "@/lib/session/runtime";

export function DebugPage() {
  const [snapshot, setSnapshot] = useState<SessionSnapshot | null>(null);
  const [includeScreenshots, setIncludeScreenshots] = useState(false);

  useEffect(() => {
    const channel = new BroadcastChannel(DEBUG_CHANNEL);
    channel.onmessage = (event: MessageEvent<DebugChannelMessage>) => {
      if (event.data?.type === "snapshot") setSnapshot(event.data.snapshot);
    };
    channel.postMessage({ type: "request" } satisfies DebugChannelMessage);
    return () => channel.close();
  }, []);

  function exportTrace() {
    const channel = new BroadcastChannel(DEBUG_CHANNEL);
    channel.postMessage({ type: "export", includeScreenshots } satisfies DebugChannelMessage);
    channel.close();
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto grid max-w-6xl gap-6 px-6 py-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.8fr)]">
        <section className="rounded-xl bg-white p-4 shadow-sm">
          <h1 className="text-sm font-semibold">Debug</h1>
          <p className="mt-1 text-xs leading-5 text-slate-600">This page is unlinked. Leave the session open in another tab.</p>
          {snapshot ? (
            <div className="mt-4">
              <EventLogPanel events={snapshot.events} limit={snapshot.events.length || 1} tall />
            </div>
          ) : (
            <p className="mt-6 text-sm text-slate-600">No session yet.</p>
          )}
        </section>
        {snapshot && (
          <div className="space-y-6">
            <Transcript
              partial={snapshot.world.conversation.partialTranscript}
              latestUser={snapshot.world.conversation.latestUserUtterance}
              lastInstruction={snapshot.world.agent.lastInstruction}
            />
            <MetricsSummary metrics={snapshot.metrics} />
            <WorldModelPanel world={snapshot.world} lastEvent={snapshot.events.at(-1) ?? null} />
            <ScreenStatePanel world={snapshot.world} />
            <ReflectionPanel world={snapshot.world} />
            <RolloutPanel rollout={snapshot.rollout} />
            <DecisionPanel world={snapshot.world} />
            <section className="space-y-2 text-sm">
              <h2 className="font-semibold">Debug trace</h2>
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={includeScreenshots} onChange={(event) => setIncludeScreenshots(event.target.checked)} />
                Include raw screenshots
              </label>
              <button
                type="button"
                disabled={snapshot.events.length === 0}
                onClick={exportTrace}
                className="min-h-11 rounded-md border border-slate-300 px-3 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-40"
              >
                Export debug trace
              </button>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
