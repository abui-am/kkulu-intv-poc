export type KuluCapture = "events" | "screen";

export type KuluSurfaceState = "opened" | "closed";

export type KuluHost = {
  page(name: string): void;
  click(label: string): void;
  surface(name: string, state: KuluSurfaceState): void;
  start(): Promise<void>;
  stop(): void;
  reset(): void;
};
