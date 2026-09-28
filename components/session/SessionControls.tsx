"use client";

export function SessionControls({
  running,
  sharing,
  onStart,
  onShare,
  onStop,
  onReset,
}: {
  running: boolean;
  sharing: boolean;
  onStart: () => void;
  onShare: () => void;
  onStop: () => void;
  onReset: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={onStart} disabled={running} className="min-h-11 cursor-pointer rounded-md bg-slate-900 px-3 py-2 text-sm text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800 disabled:cursor-not-allowed disabled:opacity-40">
        Start Session
      </button>
      <button type="button" onClick={onShare} disabled={!running || sharing} className="min-h-11 cursor-pointer rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800 disabled:cursor-not-allowed disabled:opacity-40">
        {sharing ? "Screen shared" : "Share entire screen"}
      </button>
      <button type="button" onClick={onStop} disabled={!running} className="min-h-11 cursor-pointer rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800 disabled:cursor-not-allowed disabled:opacity-40">
        Stop Session
      </button>
      <button type="button" onClick={onReset} className="min-h-11 cursor-pointer rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800">
        Reset
      </button>
    </div>
  );
}
