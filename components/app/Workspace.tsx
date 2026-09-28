"use client";

import { KuluAgent } from "@/components/embed/KuluAgent";
import { SandboxApp } from "@/components/sandbox/SandboxApp";

export function Workspace({ children }: { children: React.ReactNode }) {
  return (
    <KuluAgent capture="screen" debug>
      {(host) => (
        <div className="min-h-screen bg-slate-100 text-slate-900">
          <SandboxApp productRef={host.productRef} onInteraction={host.click} onPage={host.page}>
            {children}
          </SandboxApp>
        </div>
      )}
    </KuluAgent>
  );
}
