"use client";

export function ApiKeys() {
  return (
    <section className="flex flex-1 flex-col gap-5 bg-amber-50 p-8">
      <div className="rounded-lg border border-amber-300 bg-amber-100 px-4 py-3 text-sm text-amber-950">
        API Keys are for server credentials. They do not connect GitHub.
      </div>
      <h1 className="text-2xl font-semibold text-amber-950">API Keys</h1>
      <table className="max-w-xl overflow-hidden rounded-xl border border-amber-200 bg-white text-sm">
        <thead className="bg-amber-100 text-left text-amber-900">
          <tr>
            <th className="px-4 py-2">Name</th>
            <th className="px-4 py-2">Secret</th>
          </tr>
        </thead>
        <tbody className="font-mono text-amber-950">
          <tr>
            <td className="px-4 py-3">Production</td>
            <td className="px-4 py-3">nsk_live_9f3a…c21</td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}
