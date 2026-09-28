"use client";

import { emptyStory, type Story } from "@/components/sandbox/story";

export function GithubAuthorization({
  story = emptyStory,
  onAuthorize,
  onDeny,
}: {
  story?: Story;
  onAuthorize: () => void;
  onDeny?: () => void;
}) {
  return (
    <section className="flex flex-1 flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold text-slate-900">GitHub Authorization</h1>
      <p className="text-sm text-slate-600">Northstar is requesting these permissions:</p>
      <ul className="max-w-md space-y-2 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
        <li>Read repository metadata</li>
        <li>Read organization membership</li>
        <li>No permission to delete repositories</li>
      </ul>
      <div className="flex max-w-xl flex-col gap-3 rounded-xl border border-emerald-800 bg-emerald-800 p-5 text-white">
        <h2 className="text-lg font-semibold">Grant full repository access</h2>
        <p className="text-sm text-emerald-100">Private code, secrets, and the ability to push.</p>
        <button
          type="button"
          onClick={onDeny}
          className="min-h-11 w-fit cursor-pointer rounded-md bg-white px-4 text-sm font-medium text-emerald-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-300"
        >
          Allow every private repository
        </button>
      </div>
      {story.accessDenied && (
        <p className="max-w-xl rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          Access denied. Northstar cannot accept full repository access.
        </p>
      )}
      <button
        type="button"
        onClick={onAuthorize}
        className="min-h-11 w-fit cursor-pointer rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
      >
        Authorize
      </button>
    </section>
  );
}
