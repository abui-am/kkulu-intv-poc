import type { KuluCapture, KuluHost, KuluSurfaceState } from "@/lib/embed/host";
import { acquireController } from "@/lib/session/controller-lock";
import { createMetrics } from "@/lib/session/metrics";
import { SessionRuntime, type SessionSnapshot } from "@/lib/session/runtime";
import { createInitialWorldModel } from "@/lib/world/initial-state";

export type { KuluHost };

export type KuluView = {
  snapshot: SessionSnapshot;
  running: boolean;
  error: string | null;
  noticeTick: number;
};

const initialSnapshot = (): SessionSnapshot => ({
  world: createInitialWorldModel("pending"),
  events: [],
  metrics: createMetrics(0),
  recentTurns: [],
  error: null,
  screenSharing: false,
  sharedSurfaceLabel: null,
  hearing: false,
  ended: false,
  rollout: null,
});

export class KuluController {
  private readonly runtime: SessionRuntime;
  private releaseController: (() => void) | null = null;
  private boundSurface: { product: () => HTMLElement | null; canvas: () => HTMLCanvasElement | null } | null = null;
  private listeners = new Set<(view: KuluView) => void>();
  private starting = false;
  private disposed = false;
  private viewState: KuluView = {
    snapshot: initialSnapshot(),
    running: false,
    error: null,
    noticeTick: 0,
  };

  constructor(private readonly options: {
    capture: KuluCapture;
    product: () => HTMLElement | null;
    canvas: () => HTMLCanvasElement | null;
    onChange: (view: KuluView) => void;
  }) {
    this.runtime = new SessionRuntime((snapshot) => {
      this.viewState = { ...this.viewState, snapshot };
      this.publishView();
    });
  }

  private publishView(): void {
    this.options.onChange(this.viewState);
    for (const listener of this.listeners) listener(this.viewState);
  }

  subscribe(listener: (view: KuluView) => void): () => void {
    this.listeners.add(listener);
    listener(this.viewState);
    return () => {
      this.listeners.delete(listener);
    };
  }

  listenerCount(): number {
    return this.listeners.size;
  }

  view(): KuluView {
    return this.viewState;
  }

  bind(surface: { product: () => HTMLElement | null; canvas: () => HTMLCanvasElement | null }): void {
    this.boundSurface = surface;
  }

  host(): KuluHost {
    return {
      page: (name) => this.page(name),
      click: (label) => this.click(label),
      surface: (name, state) => this.surface(name, state),
      start: () => this.start(),
      stop: () => this.stop(),
      reset: () => this.reset(),
    };
  }

  page(name: string): void {
    this.runtime.reportPage(name);
  }

  click(label: string): void {
    if (this.viewState.running) {
      this.viewState = { ...this.viewState, noticeTick: this.viewState.noticeTick + 1 };
      this.publishView();
    }
    this.runtime.reportClick(label);
  }

  surface(name: string, state: KuluSurfaceState): void {
    this.runtime.reportSurface(name, state);
  }

  async start(): Promise<void> {
    if (this.starting || this.releaseController) return;
    if (this.disposed && this.listenerCount() === 0) return;
    this.disposed = false;
    this.starting = true;
    const eventsOnly = this.options.capture === "events";
    if (eventsOnly) this.runtime.startFromEvents();
    else this.runtime.start();
    const sharePromise = eventsOnly ? null : this.share();
    try {
      const release = await acquireController();
      if (this.disposed) {
        release?.();
        this.runtime.stop();
        await sharePromise?.catch(() => undefined);
        return;
      }
      if (!release) {
        this.runtime.stop();
        await sharePromise?.catch(() => undefined);
        this.fail("Another agent session is active, or this browser cannot coordinate a single voice controller.");
        return;
      }
      this.releaseController = release;
      this.viewState = { ...this.viewState, running: true, error: null };
      this.publishView();
      await sharePromise;
    } catch (error) {
      this.runtime.stop();
      this.releaseController?.();
      this.releaseController = null;
      this.fail(error instanceof Error ? error.message : "The session did not start. Please try again.");
    } finally {
      this.starting = false;
    }
  }

  stop(): void {
    this.runtime.stop();
    this.releaseController?.();
    this.releaseController = null;
    this.viewState = { ...this.viewState, running: false };
    this.publishView();
  }

  reset(): void {
    this.runtime.reset();
    this.releaseController?.();
    this.releaseController = null;
    this.viewState = { ...this.viewState, running: false, error: null };
    this.publishView();
  }

  async reshare(): Promise<void> {
    if (this.options.capture !== "screen" || !this.viewState.running) return;
    try {
      await this.share();
      this.viewState = { ...this.viewState, error: null };
      this.publishView();
    } catch (error) {
      this.viewState = {
        ...this.viewState,
        error: error instanceof Error ? error.message : "Screen sharing did not start. Please try again.",
      };
      this.publishView();
    }
  }

  exportTrace(includeScreenshots: boolean): void {
    this.runtime.exportTrace(includeScreenshots);
  }

  destroy(): void {
    this.disposed = true;
    this.stop();
  }

  private async share(): Promise<void> {
    const canvas = this.boundSurface?.canvas() ?? this.options.canvas();
    const product = this.boundSurface?.product() ?? this.options.product();
    if (!canvas || !product) throw new Error("The product surface is not ready.");
    await this.runtime.shareScreen(canvas, product);
  }

  private fail(message: string): void {
    this.viewState = { ...this.viewState, running: false, error: message };
    this.publishView();
  }
}
