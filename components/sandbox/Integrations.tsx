"use client";

import { emptyStory, type Story } from "@/components/sandbox/story";

const CARDS = [
  { name: "Slack", detail: "Most teams start here", featured: true },
  { name: "HubSpot", detail: "CRM contacts and deals", featured: false },
  { name: "GitHub", detail: "Repositories, pull requests, and issues", featured: false },
];

export function Integrations({
  story = emptyStory,
  onSelectGithub,
  onSlack,
  onHubspot,
}: {
  story?: Story;
  onSelectGithub: () => void;
  onSlack?: () => void;
  onHubspot?: () => void;
}) {
  return (
    <section className="flex flex-1 flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold text-slate-900">Integrations</h1>
      <p className="text-sm text-slate-600">Connect the tools your revenue team already uses.</p>
      {story.slackBlocked && (
        <p className="max-w-xl rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          Slack needs a paid seat, and it still would not connect GitHub.
        </p>
      )}
      {story.hubspotRequested && (
        <p className="max-w-xl rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
          HubSpot access requested. Nothing was connected.
        </p>
      )}
      <div className="grid max-w-3xl grid-cols-3 gap-4">
        {CARDS.map((card) => (
          <button
            key={card.name}
            type="button"
            onClick={
              card.name === "GitHub"
                ? onSelectGithub
                : card.name === "Slack"
                  ? onSlack
                  : onHubspot
            }
            className={`min-h-11 cursor-pointer rounded-xl border p-4 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800 ${
              card.featured
                ? "border-slate-900 bg-slate-900 text-white hover:bg-slate-800"
                : "border-slate-200 bg-white hover:border-slate-400"
            }`}
          >
            {card.featured && <p className="text-[10px] font-medium tracking-wide text-teal-200">POPULAR</p>}
            <p className={`text-lg font-semibold ${card.featured ? "text-white" : "text-slate-900"}`}>{card.name}</p>
            <p className={`mt-2 text-sm ${card.featured ? "text-slate-300" : "text-slate-600"}`}>
              {card.name === "Slack" && story.slackBlocked
                ? "Blocked. A paid seat is required."
                : card.name === "HubSpot" && story.hubspotRequested
                  ? "Request filed. Nothing connected."
                  : card.name === "GitHub" && story.githubConnected
                    ? "Connected for Acme North."
                    : card.detail}
            </p>
          </button>
        ))}
      </div>
    </section>
  );
}
