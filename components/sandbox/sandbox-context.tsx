"use client";

import { createContext, useContext } from "react";
import type { SandboxScreen } from "@/components/sandbox/history";
import type { Story } from "@/components/sandbox/story";

export type SandboxApi = {
  story: Story;
  mark: (fact: keyof Story) => void;
  visit: (screen: SandboxScreen) => void;
};

const SandboxContext = createContext<SandboxApi | null>(null);

export function SandboxProvider({ value, children }: { value: SandboxApi; children: React.ReactNode }) {
  return <SandboxContext.Provider value={value}>{children}</SandboxContext.Provider>;
}

export function useSandbox(): SandboxApi {
  const value = useContext(SandboxContext);
  if (!value) throw new Error("Sandbox screens render inside the workspace layout");
  return value;
}
