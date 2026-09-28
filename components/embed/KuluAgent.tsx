"use client";

import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { KuluController, type KuluView } from "@/lib/embed/controller";
import type { KuluCapture, KuluHost } from "@/lib/embed/host";
import { DEBUG_CHANNEL, mirrorSession, type DebugChannelMessage } from "@/lib/session/channel";
import { createMetrics } from "@/lib/session/metrics";
import type { SessionSnapshot } from "@/lib/session/runtime";
import { createInitialWorldModel } from "@/lib/world/initial-state";
import { AgentWidget } from "@/components/agent/AgentWidget";
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

const initialSnapshot: SessionSnapshot = {
  world: createInitialWorldModel("pending"),
  events: [],
  metrics: createMetrics(0),
  recentTurns: [],
  error: null,
  screenSharing: false,
  sharedSurfaceLabel: null,
  hearing: false,
  ended: false,
  rollout: null,
};

const initialView: KuluView = {
  snapshot: initialSnapshot,
  running: false,
  error: null,
  noticeTick: 0,
};

export type KuluReactHost = KuluHost & {
  productRef: RefObject<HTMLDivElement | null>;
};

export function KuluAgent({
  capture = "events",
  debug = false,
  controller,
  children,
}: {
  capture?: KuluCapture;
  debug?: boolean;
  controller?: KuluController;
  children?: (host: KuluReactHost) => ReactNode;
}) {
  const productRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [ownedController] = useState(() => controller ?? new KuluController({
    capture,
    product: () => null,
    canvas: () => null,
    onChange() {},
  }));
  const [host] = useState<KuluReactHost>(() => ({
    ...ownedController.host(),
    productRef,
  }));
  const [view, setView] = useState<KuluView>(initialView);
  const [noticing, setNoticing] = useState(false);
  const [includeScreenshots, setIncludeScreenshots] = useState(false);
  const snapshotRef = useRef(initialSnapshot);
  const debugChannelRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    ownedController.bind({
      product: () => productRef.current,
      canvas: () => canvasRef.current,
    });
    let noticeTick = ownedController.view().noticeTick;
    let noticeTimer: number | null = null;
    const unsubscribe = ownedController.subscribe((nextView) => {
      setView(nextView);
      if (nextView.noticeTick === noticeTick) return;
      noticeTick = nextView.noticeTick;
      setNoticing(true);
      if (noticeTimer !== null) window.clearTimeout(noticeTimer);
      noticeTimer = window.setTimeout(() => setNoticing(false), 1_200);
    });
    const onHide = () => ownedController.destroy();
    window.addEventListener("pagehide", onHide);
    return () => {
      unsubscribe();
      window.removeEventListener("pagehide", onHide);
      if (noticeTimer !== null) window.clearTimeout(noticeTimer);
      window.setTimeout(() => {
        if (ownedController.listenerCount() === 0) ownedController.destroy();
      }, 0);
    };
  }, [ownedController]);

  useEffect(() => {
    const channel = new BroadcastChannel(DEBUG_CHANNEL);
    debugChannelRef.current = channel;
    const send = () => channel.postMessage({ type: "snapshot", snapshot: snapshotRef.current } satisfies DebugChannelMessage);
    channel.onmessage = (event: MessageEvent<DebugChannelMessage>) => {
      if (event.data?.type === "request") send();
      if (event.data?.type === "export") ownedController.exportTrace(event.data.includeScreenshots);
    };
    send();
    return () => {
      channel.close();
      debugChannelRef.current = null;
    };
  }, [ownedController]);

  useEffect(() => {
    snapshotRef.current = view.snapshot;
    debugChannelRef.current?.postMessage({ type: "snapshot", snapshot: view.snapshot } satisfies DebugChannelMessage);
  }, [view.snapshot]);

  const snapshot = view.snapshot;
  const alert = view.error ?? snapshot.error;
  const mirrored = view.running || snapshot.ended ? mirrorSession(snapshot) : null;

  return (
    <>
      {children?.(host)}
      <canvas ref={canvasRef} className="hidden" width={320} height={180} />
      <AgentWidget
        session={mirrored}
        noticing={noticing}
        running={view.running}
        sharing={snapshot.screenSharing}
        error={alert}
        allowShare={capture === "screen"}
        onStart={() => {
          void host.start();
        }}
        onStop={() => host.stop()}
        onShare={() => {
          void ownedController.reshare();
        }}
        onReset={() => host.reset()}
        onInstructionsSaved={(workflow) => ownedController.refreshInstructionManual(workflow)}
        debug={debug ? (
          <>
            <Transcript
              partial={snapshot.world.conversation.partialTranscript}
              latestUser={snapshot.world.conversation.latestUserUtterance}
              lastInstruction={snapshot.world.agent.lastInstruction}
            />
            {snapshot.ended && <MetricsSummary metrics={snapshot.metrics} />}
            <WorldModelPanel world={snapshot.world} lastEvent={snapshot.events.at(-1) ?? null} />
            <ScreenStatePanel world={snapshot.world} />
            <ReflectionPanel world={snapshot.world} />
            <RolloutPanel rollout={snapshot.rollout} />
            <DecisionPanel world={snapshot.world} />
            <EventLogPanel events={snapshot.events} />
            <section className="space-y-2 text-sm">
              <h2 className="font-semibold">Debug trace</h2>
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={includeScreenshots} onChange={(event) => setIncludeScreenshots(event.target.checked)} />
                Include raw screenshots
              </label>
              <button type="button" disabled={snapshot.events.length === 0} onClick={() => ownedController.exportTrace(includeScreenshots)} className="min-h-11 rounded-md border border-slate-300 px-3 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-40">
                Export debug trace
              </button>
            </section>
          </>
        ) : null}
      />
    </>
  );
}
