"use client";

import { useEffect, useState, type MouseEvent, type ReactNode, type RefObject } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar } from "@/components/sandbox/Sidebar";
import { historyIndex, screenFromPath, screenPath, type SandboxScreen } from "@/components/sandbox/history";
import { SandboxProvider } from "@/components/sandbox/sandbox-context";
import { emptyStory, remember, type Story } from "@/components/sandbox/story";

const PAGE_LABELS: Record<SandboxScreen, string> = {
  dashboard: "Dashboard",
  settings: "Settings",
  integrations: "Integrations",
  github: "GitHub Integration",
  authorize: "GitHub Authorization",
  connected: "GitHub Connected",
  "api-keys": "API Keys",
  ambiguous: "Unknown",
};

export function SandboxApp({
  productRef,
  onInteraction,
  onPage,
  children,
}: {
  productRef: RefObject<HTMLDivElement | null>;
  onInteraction: (label: string, at: number) => void;
  onPage: (page: string, at: number) => void;
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const screen = screenFromPath(pathname);
  const [story, setStory] = useState<Story>(emptyStory);
  const [loading, setLoading] = useState(pathname === "/integrations");
  const [trackedPath, setTrackedPath] = useState(pathname);
  const [canBack, setCanBack] = useState(false);

  if (pathname !== trackedPath) {
    setTrackedPath(pathname);
    setLoading(pathname === "/integrations");
  }

  useEffect(() => {
    if (pathname !== "/integrations") return;
    const timer = window.setTimeout(() => setLoading(false), 1000);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  useEffect(() => {
    const update = () => setCanBack(historyIndex(currentHistoryEntry()) > 0);
    update();
    const navigation = windowNavigation();
    navigation?.addEventListener("currententrychange", update);
    window.addEventListener("popstate", update);
    return () => {
      navigation?.removeEventListener("currententrychange", update);
      window.removeEventListener("popstate", update);
    };
  }, [pathname]);

  function mark(fact: keyof Story) {
    setStory((current) => remember(current, fact));
  }

  function visit(next: SandboxScreen) {
    const href = screenPath(next);
    if (href === pathname) return;
    router.push(href);
  }

  function reset() {
    setStory(emptyStory);
    if (pathname !== "/") router.push("/");
  }

  const reportedPage = loading && screen === "integrations" ? "Loading" : PAGE_LABELS[screen];

  useEffect(() => {
    onPage(reportedPage, Date.now());
  }, [onPage, reportedPage]);

  function reportClick(event: MouseEvent<HTMLDivElement>): void {
    if ((event.target as HTMLElement).closest("[data-sandbox-chrome]")) return;
    const button = (event.target as HTMLElement).closest("button");
    if (!button || !event.currentTarget.contains(button)) return;
    const label = button.textContent?.trim().replace(/\s+/g, " ").slice(0, 80);
    if (!label) return;
    onInteraction(label, Date.now());
  }

  const showLoading = loading && screen === "integrations";

  return (
    <SandboxProvider value={{ story, mark, visit }}>
      <div ref={productRef} className="flex min-h-screen min-w-0 flex-1 bg-slate-100 text-slate-900" onClick={reportClick}>
        <Sidebar
          page={screen === "dashboard" ? "dashboard" : "settings"}
          story={story}
          onNavigate={(next) => visit(next === "dashboard" ? "dashboard" : "settings")}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <div data-sandbox-chrome="" className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-2">
            <button
              type="button"
              onClick={() => router.back()}
              disabled={!canBack}
              className="min-h-11 cursor-pointer rounded-md px-3 text-sm font-medium text-slate-800 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Back
            </button>
            <p className="text-sm text-slate-500">{reportedPage}</p>
          </div>
          {showLoading ? (
            <section className="flex flex-1 flex-col items-start justify-center gap-4 p-8">
              <p className="text-lg text-slate-600">Loading integrations…</p>
              <button
                type="button"
                onClick={() => visit("api-keys")}
                className="min-h-11 cursor-pointer rounded-md bg-slate-900 px-4 text-sm font-medium text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
              >
                Skip the wait with a token
              </button>
            </section>
          ) : (
            children
          )}
          <footer data-sandbox-chrome="" className="relative z-40 flex items-center justify-between border-t border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
            <span>Demo controls</span>
            <span className="flex gap-2">
              <button
                type="button"
                className="min-h-11 cursor-pointer rounded-md border border-slate-300 px-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
                onClick={() => visit("ambiguous")}
              >
                Unclear screen
              </button>
              <button
                type="button"
                className="min-h-11 cursor-pointer rounded-md border border-slate-300 px-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
                onClick={reset}
              >
                Reset
              </button>
            </span>
          </footer>
        </div>
      </div>
    </SandboxProvider>
  );
}

function currentHistoryEntry(): unknown {
  return windowNavigation()?.currentEntry ?? null;
}

function windowNavigation(): { currentEntry?: unknown; addEventListener: (type: string, listener: () => void) => void; removeEventListener: (type: string, listener: () => void) => void } | null {
  const candidate = (window as Window & { navigation?: { currentEntry?: unknown; addEventListener: (type: string, listener: () => void) => void; removeEventListener: (type: string, listener: () => void) => void } }).navigation;
  return candidate ?? null;
}
