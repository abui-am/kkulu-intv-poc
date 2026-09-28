export const SANDBOX_SCREENS = [
  "dashboard",
  "settings",
  "integrations",
  "github",
  "authorize",
  "connected",
  "api-keys",
  "ambiguous",
] as const;

export type SandboxScreen = (typeof SANDBOX_SCREENS)[number];

const SCREEN_PATHS: Record<SandboxScreen, string> = {
  dashboard: "/",
  settings: "/settings",
  integrations: "/integrations",
  github: "/github",
  authorize: "/authorize",
  connected: "/connected",
  "api-keys": "/api-keys",
  ambiguous: "/unclear",
};

export function isSandboxScreen(value: unknown): value is SandboxScreen {
  return typeof value === "string" && SANDBOX_SCREENS.some((screen) => screen === value);
}

export function screenPath(screen: SandboxScreen): string {
  return SCREEN_PATHS[screen];
}

export function screenFromPath(pathname: string): SandboxScreen {
  const match = SANDBOX_SCREENS.find((screen) => SCREEN_PATHS[screen] === pathname);
  return match ?? "dashboard";
}

export function historyIndex(state: unknown): number {
  if (!state || typeof state !== "object") return 0;
  const record = state as { idx?: unknown; index?: unknown };
  const index = record.idx ?? record.index;
  return typeof index === "number" ? index : 0;
}
