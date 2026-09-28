"use client";

import { useState } from "react";
import { compileWorkflow, readManual, type ManualStepInput } from "@/lib/workflow/manual";
import type { Workflow } from "@/lib/workflow/model";

export function InstructionSettings({ onSaved }: { onSaved: (workflow: Workflow) => void }) {
  const [text, setText] = useState(() => readManual());
  const [lines, setLines] = useState<Array<{ page: string; target: string; expectedPage: string; instruction: string }> | null>(null);
  const [status, setStatus] = useState<"idle" | "reading" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setStatus("reading");
    setError(null);
    try {
      const response = await fetch("/api/openai/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ manual: text }),
      });
      const payload: unknown = await response.json();
      if (!response.ok) {
        const message = payload && typeof payload === "object" && "error" in payload ? String(payload.error) : "Could not read the manual";
        throw new Error(message);
      }
      const steps = (payload as { steps: ManualStepInput[] }).steps;
      const workflow = compileWorkflow(text, steps);
      if (!workflow) throw new Error("Could not read the manual");
      setLines(workflow.steps);
      setStatus("saved");
      onSaved(workflow);
    } catch (caught) {
      setStatus("error");
      setError(caught instanceof Error ? caught.message : "Could not read the manual");
    }
  }

  return (
    <section className="mt-3 space-y-3 text-slate-900">
      <div>
        <h2 className="text-xs font-semibold tracking-[0.14em] text-slate-500">INSTRUCTION MANUAL</h2>
        <p className="mt-1 text-xs leading-5 text-slate-600">Write the workflow the way you would hand it to someone. Saving turns that prose into the ordered steps the guide follows, including which control to use. It stays in memory for this tab.</p>
      </div>
      <textarea
        value={text}
        onChange={(event) => {
          setStatus("idle");
          setText(event.target.value);
        }}
        rows={16}
        aria-label="Instruction manual"
        className="w-full resize-y rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm leading-5 text-slate-900"
      />
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => void save()} disabled={status === "reading"} className="min-h-11 cursor-pointer rounded-md bg-slate-950 px-3 text-sm font-medium text-white disabled:cursor-wait disabled:opacity-60">
          {status === "reading" ? "Reading the manual…" : "Save manual"}
        </button>
        {status === "saved" && <p className="text-xs text-teal-800">Saved for this session.</p>}
      </div>
      {error && <p className="text-xs leading-5 text-amber-800">{error}</p>}
      {lines && (
        <ol className="space-y-2 text-xs leading-5 text-slate-700">
          {lines.map((line) => (
            <li key={line.page}>
              <span className="font-medium text-slate-900">{line.page}. </span>
              Click {line.target}, then {line.expectedPage}. {line.instruction}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
