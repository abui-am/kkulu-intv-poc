"use client";

export function Settings({
  onOpenIntegrations,
  onOpenApiKeys,
}: {
  onOpenIntegrations: () => void;
  onOpenApiKeys: () => void;
}) {
  return (
    <section className="flex flex-1 flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold text-slate-900">Settings</h1>
      <div className="flex gap-2 text-sm">
        <span className="rounded-full bg-slate-900 px-3 py-1 text-white">General</span>
        <button type="button" onClick={onOpenIntegrations} className="min-h-11 cursor-pointer rounded-full bg-slate-100 px-4 text-slate-800 hover:bg-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800">
          Integrations
        </button>
        <button type="button" onClick={onOpenApiKeys} className="min-h-11 cursor-pointer rounded-full bg-slate-100 px-4 text-slate-800 hover:bg-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800">
          API Keys
        </button>
      </div>
      <form className="max-w-lg space-y-4 rounded-xl border border-slate-200 bg-white p-5">
        <label className="block text-sm text-slate-600">
          Workspace name
          <input readOnly value="Acme North" className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2" />
        </label>
        <label className="block text-sm text-slate-600">
          Time zone
          <input readOnly value="Pacific Time" className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2" />
        </label>
      </form>
    </section>
  );
}
