"use client";

import { useEffect, useRef } from "react";

const labels: Record<string, string> = {
  idle: "Idle",
  listening: "Listening",
  hearing: "Hearing",
  thinking: "Thinking",
  speaking: "Speaking",
};

export function AgentPresence({
  mode,
  subscribeLevel,
  onActivate,
  activateLabel,
}: {
  mode: string;
  subscribeLevel: (listener: (level: number) => void) => () => void;
  onActivate?: () => void;
  activateLabel?: string;
}) {
  const orbRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return subscribeLevel((level) => {
      orbRef.current?.style.setProperty("--mic-level", level.toFixed(3));
    });
  }, [subscribeLevel]);

  return (
    <div className="flex items-center gap-3">
      <p className="text-sm font-medium text-slate-800">{labels[mode] ?? mode}</p>
      {onActivate ? (
        <button
          type="button"
          aria-label={activateLabel}
          onClick={onActivate}
          className="cursor-pointer rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
        >
          <div ref={orbRef} className={`agent-orb agent-orb-${mode}`} style={{ ["--mic-level" as string]: 0 }}>
            <span />
            <span />
          </div>
        </button>
      ) : (
        <div ref={orbRef} className={`agent-orb agent-orb-${mode}`} style={{ ["--mic-level" as string]: 0 }}>
          <span />
          <span />
        </div>
      )}
    </div>
  );
}
