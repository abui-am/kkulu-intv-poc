"use client";

import type { SessionEvent } from "@/lib/events/types";
import type { SessionMetrics } from "@/lib/session/metrics";
import { median } from "@/lib/session/metrics";
import { workflowStepLabels, workflowStepOrder } from "@/lib/workflow/github-workflow";
import type { WorldModel } from "@/lib/world/types";

function formatTime(at: number): string {
  return new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function describe(event: SessionEvent): string {
  switch (event.type) {
    case "SCREEN_STATE_UPDATED":
      return `SCREEN_STATE_UPDATED v${event.semanticVersion}`;
    case "REASONING_STARTED":
      return `REASONING_STARTED v${event.basedOnScreenVersion}`;
    case "DECISION_READY":
      return `DECISION_READY based_on=v${event.decision.basedOnScreenVersion}`;
    case "DECISION_REJECTED_STALE":
      return `DECISION_REJECTED_STALE current=v${event.currentScreenVersion}`;
    case "WORKFLOW_STEP_VERIFIED":
      return `WORKFLOW_STEP_VERIFIED ${event.stepId}`;
    case "WORKFLOW_DEVIATION":
      return `WORKFLOW_DEVIATION expected ${event.expected} observed ${event.observed}`;
    case "FRAME_SAMPLED":
      return `FRAME_SAMPLED v${event.frameVersion} Δ${event.changeRatio.toFixed(3)}`;
    default:
      return event.type;
  }
}

export function WorldModelPanel({ world, lastEvent }: { world: WorldModel; lastEvent: SessionEvent | null }) {
  return (
    <section className="space-y-4 text-sm">
      <h2 className="text-xs font-semibold tracking-[0.14em] text-slate-600">WORLD MODEL</h2>
      <dl className="space-y-3">
        <div>
          <dt className="text-xs text-slate-600">Goal</dt>
          <dd className="font-medium text-slate-900">{world.goal.description}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-600">Screen v{world.screen.semanticVersion}</dt>
          <dd className="font-medium text-slate-900">
            {world.screen.page ?? "unknown"} · {world.screen.perceptionStatus}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-600">Current step</dt>
          <dd className="font-medium text-slate-900">{world.workflow.currentStep}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-600">Expected next</dt>
          <dd className="font-medium text-slate-900">{world.workflow.expectedNextState ?? "—"}</dd>
        </div>
      </dl>
      <ol className="space-y-1">
        {workflowStepOrder.map((step) => {
          const done = world.workflow.completedSteps.includes(step);
          const current = world.workflow.currentStep === step && !done;
          return (
            <li
              key={step}
              className={`rounded-md px-2 py-1 ${current ? "bg-teal-50 font-medium text-teal-950" : "text-slate-700"}`}
            >
              {done ? "✓" : "○"} {workflowStepLabels[step]}
            </li>
          );
        })}
      </ol>
      <p className="text-xs leading-5 text-slate-600">
        Last user: {world.conversation.latestUserUtterance ? `"${world.conversation.latestUserUtterance}"` : "—"}
        <br />
        Last event: {lastEvent ? lastEvent.type : "—"}
        <br />
        Reasoning from screen v{world.expectation.createdFromScreenVersion ?? world.screen.semanticVersion}
      </p>
      {world.flags.conflictingEvidence && <p className="text-sm font-medium text-amber-800">Conflicting evidence</p>}
      {world.agent.speechInterrupted && <p className="text-sm font-medium text-amber-800">Speech interrupted</p>}
    </section>
  );
}

export function EventLogPanel({ events }: { events: SessionEvent[] }) {
  const visible = events.filter((event) => event.type !== "FRAME_SAMPLED").slice(-12);
  return (
    <section>
      <h2 className="text-sm font-semibold">Event log</h2>
      <ol className="mt-2 max-h-64 space-y-1 overflow-auto font-mono text-xs leading-5 text-slate-700">
        {visible.length === 0 && <li className="font-sans text-slate-600">No events yet</li>}
        {visible.map((event, index) => (
          <li key={`${event.type}-${event.at}-${index}`} className={event.type === "DECISION_REJECTED_STALE" ? "text-red-700" : ""}>
            {formatTime(event.at)} {describe(event)}
          </li>
        ))}
      </ol>
    </section>
  );
}

export function DecisionPanel({ world }: { world: WorldModel }) {
  const decision = world.agent.lastDecision;
  return (
    <section className="text-sm">
      <h2 className="font-semibold">Current decision</h2>
      {decision ? (
        <p className="mt-2 text-slate-700">
          {decision.type} · {decision.reasoningClass} · screen v{decision.basedOnScreenVersion}
          <br />
          {decision.response}
        </p>
      ) : (
        <p className="mt-2 text-slate-600">No decision yet</p>
      )}
    </section>
  );
}

export function ScreenStatePanel({ world }: { world: WorldModel }) {
  return (
    <section className="text-sm">
      <h2 className="font-semibold">Screen state</h2>
      <p className="mt-2 leading-6 text-slate-700">{world.screen.summary ?? "No observation yet"}</p>
    </section>
  );
}

export function MetricsSummary({ metrics }: { metrics: SessionMetrics }) {
  const reasoning = median(metrics.reasoningLatenciesMs);
  return (
    <section className="text-sm">
      <h2 className="font-semibold">Session summary</h2>
      <ul className="mt-2 space-y-1 text-slate-700">
        <li>Vision calls: {metrics.visionCalls}</li>
        <li>Fast / deep reasoner: {metrics.fastReasonerCalls} / {metrics.deepReasonerCalls}</li>
        <li>Semantic screen changes: {metrics.semanticScreenChanges}</li>
        <li>Ignored frame changes: {metrics.ignoredFrameChanges}</li>
        <li>Stale decisions rejected: {metrics.staleDecisionsRejected}</li>
        <li>Deviations / recoveries: {metrics.workflowDeviations} / {metrics.successfulRecoveries}</li>
        <li>Interruptions: {metrics.interruptions}</li>
        <li>Median reasoning latency: {reasoning == null ? "—" : `${Math.round(reasoning)} ms`}</li>
      </ul>
    </section>
  );
}
