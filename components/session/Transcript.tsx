"use client";

export function Transcript({
  partial,
  latestUser,
  lastInstruction,
}: {
  partial: string;
  latestUser: string | null;
  lastInstruction: string | null;
}) {
  const you = partial || latestUser;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <article className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-600">You</p>
        <p className="mt-2 min-h-12 text-sm leading-6 text-slate-900">{you || "Waiting for speech"}</p>
      </article>
      <article className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-600">Agent</p>
        <p className="mt-2 min-h-12 text-sm leading-6 text-slate-900">{lastInstruction || "No instruction yet"}</p>
      </article>
    </div>
  );
}
