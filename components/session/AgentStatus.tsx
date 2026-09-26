"use client";

import type { AgentStatus } from "@/lib/world/types";

const labels: Record<AgentStatus, string> = {
  idle: "idle",
  listening: "listening",
  thinking: "thinking",
  speaking: "speaking",
};

export function AgentStatus({ status }: { status: AgentStatus }) {
  return (
    <p className="text-sm text-slate-600">
      Agent <span className="font-medium text-slate-900">{labels[status]}</span>
    </p>
  );
}
