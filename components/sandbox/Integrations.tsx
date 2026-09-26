"use client";

const CARDS = [
  { name: "GitHub", detail: "Repositories, pull requests, and issues" },
  { name: "Slack", detail: "Channel notifications" },
  { name: "HubSpot", detail: "CRM contacts and deals" },
];

export function Integrations({ onSelectGithub }: { onSelectGithub: () => void }) {
  return (
    <section className="flex flex-1 flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold text-slate-900">Integrations</h1>
      <p className="text-sm text-slate-600">Connect the tools your revenue team already uses.</p>
      <div className="grid max-w-3xl grid-cols-3 gap-4">
        {CARDS.map((card) => (
          <button
            key={card.name}
            type="button"
            onClick={card.name === "GitHub" ? onSelectGithub : undefined}
            className="min-h-11 cursor-pointer rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:border-slate-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
          >
            <p className="text-lg font-semibold text-slate-900">{card.name}</p>
            <p className="mt-2 text-sm text-slate-600">{card.detail}</p>
          </button>
        ))}
      </div>
    </section>
  );
}
