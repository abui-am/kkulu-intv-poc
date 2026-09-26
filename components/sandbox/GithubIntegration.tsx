"use client";

export function GithubIntegration({ onConnect }: { onConnect: () => void }) {
  return (
    <section className="flex flex-1 flex-col gap-6 p-8">
      <p className="text-xs font-medium tracking-wide text-slate-600">INTEGRATIONS</p>
      <h1 className="text-2xl font-semibold text-slate-900">GitHub Integration</h1>
      <p className="max-w-lg text-sm text-slate-600">
        Northstar can read repository metadata after you approve access. Your GitHub password is never shared.
      </p>
      <button
        type="button"
        onClick={onConnect}
        className="min-h-11 w-fit cursor-pointer rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
      >
        Connect GitHub
      </button>
    </section>
  );
}
