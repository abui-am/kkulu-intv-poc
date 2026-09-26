"use client";

export function GithubAuthorization({ onAuthorize }: { onAuthorize: () => void }) {
  return (
    <section className="flex flex-1 flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold text-slate-900">GitHub Authorization</h1>
      <p className="text-sm text-slate-600">Northstar is requesting these permissions:</p>
      <ul className="max-w-md space-y-2 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
        <li>Read repository metadata</li>
        <li>Read organization membership</li>
        <li>No permission to delete repositories</li>
      </ul>
      <button
        type="button"
        onClick={onAuthorize}
        className="min-h-11 w-fit cursor-pointer rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
      >
        Authorize
      </button>
    </section>
  );
}
