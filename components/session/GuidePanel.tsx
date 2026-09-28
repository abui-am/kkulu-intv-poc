"use client";

import type { Guide } from "@/lib/workflow/guide";
import { workflowStepOrder } from "@/lib/workflow/github-workflow";

export function GuidePanel({
  guide,
  verifiedCount,
  skippedCount,
  compact = false,
}: {
  guide: Guide | null;
  verifiedCount: number;
  skippedCount: number;
  compact?: boolean;
}) {
  const instruction = guide?.instruction ?? "Start the session to begin.";
  return (
    <section
      aria-label="Current task guide"
      aria-live="polite"
      className={compact
        ? "rounded-lg border border-teal-700/60 bg-teal-950/60 p-3 text-white"
        : "rounded-xl border border-teal-200 bg-teal-50 p-4 text-teal-950"}
    >
      <h2 className="text-xs font-semibold uppercase tracking-wide opacity-75">
        {guide?.kind === "complete" ? "Task complete" : "Current action"}
      </h2>
      <p className="mt-1 text-xs opacity-75">
        {verifiedCount}/{workflowStepOrder.length} screens verified{skippedCount > 0 ? ` · ${skippedCount} not seen` : ""}
      </p>
      <p className="mt-1 text-sm font-medium leading-6">{instruction}</p>
      {guide?.kind === "action" && (
        <p className="mt-1 text-xs opacity-75">Target: {guide.target} · Next screen: {guide.expectedPage}</p>
      )}
    </section>
  );
}
