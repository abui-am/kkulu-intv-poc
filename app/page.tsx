import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center gap-8 px-6 py-16">
      <div>
        <p className="text-xs font-medium tracking-[0.16em] text-teal-800">SCREEN-AWARE VOICE AGENT</p>
        <h1 className="mt-2 max-w-xl text-4xl font-semibold tracking-tight">Connect GitHub while the agent watches the screen.</h1>
        <p className="mt-4 max-w-xl text-lg leading-8 text-slate-600">
          Open the product and use the agent in the corner, the way a user would. The session page is the same trace on its own screen.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/sandbox" className="cursor-pointer rounded-2xl border border-slate-200 bg-white p-5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800">
          <p className="text-xs font-medium tracking-wide text-slate-600">USE THIS</p>
          <p className="mt-2 text-lg font-semibold">Sandbox</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">The product, with the agent sitting in the corner.</p>
        </Link>
        <Link href="/session" className="cursor-pointer rounded-2xl border border-slate-900 bg-slate-900 p-5 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-300">
          <p className="text-xs font-medium tracking-wide text-teal-200">OPTIONAL TRACE</p>
          <p className="mt-2 text-lg font-semibold">Session</p>
          <p className="mt-2 text-sm leading-6 text-slate-300">A private copy of the world model, if you want it off to the side.</p>
        </Link>
      </div>
    </main>
  );
}
