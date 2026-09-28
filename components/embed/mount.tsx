"use client";

import { createRoot, type Root } from "react-dom/client";
import { KuluAgent } from "@/components/embed/KuluAgent";
import { KuluController } from "@/lib/embed/controller";
import type { KuluCapture, KuluHost } from "@/lib/embed/host";

export function mountKulu(target: HTMLElement, options?: { capture?: KuluCapture }): KuluHost & { unmount(): void } {
  const controller = new KuluController({
    capture: options?.capture ?? "events",
    product: () => null,
    canvas: () => null,
    onChange() {},
  });
  const root: Root = createRoot(target);
  root.render(<KuluAgent controller={controller} capture={options?.capture ?? "events"} />);
  return {
    ...controller.host(),
    unmount() {
      root.unmount();
    },
  };
}
