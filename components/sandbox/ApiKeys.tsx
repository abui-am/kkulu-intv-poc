"use client";

import { useState } from "react";

export function ApiKeys() {
  const [saved, setSaved] = useState(false);
  return (
    <section className="flex flex-1 flex-col gap-5 p-8">
      <h1 className="text-2xl font-semibold text-slate-900">API Keys</h1>
      <p className="max-w-lg text-sm text-slate-600">Create a credential for server jobs. This screen looks like the end of setup.</p>
      <button
        type="button"
        onClick={() => setSaved(true)}
        className="min-h-11 w-fit cursor-pointer rounded-md bg-slate-900 px-4 text-sm font-medium text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
      >
        Create GitHub token
      </button>
      {saved && (
        <div className="max-w-xl rounded-xl border border-emerald-200 bg-emerald-50 p-5">
          <p className="text-sm font-medium text-emerald-800">Token saved</p>
          <p className="mt-2 font-mono text-sm text-emerald-950">nsk_live_9f3a…c21</p>
          <p className="mt-3 text-sm text-emerald-900">The token is stored. GitHub repository access is still off.</p>
        </div>
      )}
      <table className="max-w-xl overflow-hidden rounded-xl border border-slate-200 bg-white text-sm">
        <thead className="bg-slate-50 text-left text-slate-600">
          <tr>
            <th className="px-4 py-2">Name</th>
            <th className="px-4 py-2">Secret</th>
          </tr>
        </thead>
        <tbody className="font-mono text-slate-900">
          <tr>
            <td className="px-4 py-3">Production</td>
            <td className="px-4 py-3">{saved ? "nsk_live_9f3a…c21" : "Not created"}</td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}
