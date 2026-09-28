import { createElement, createRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { Dashboard } from "@/components/sandbox/Dashboard";
import { historyIndex, screenFromPath, screenPath } from "@/components/sandbox/history";
import { SandboxApp } from "@/components/sandbox/SandboxApp";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({
    push: () => undefined,
    back: () => undefined,
  }),
}));

describe("sandbox pages", () => {
  it("maps each screen onto a Next.js page", () => {
    expect(screenPath("dashboard")).toBe("/");
    expect(screenPath("settings")).toBe("/settings");
    expect(screenPath("api-keys")).toBe("/api-keys");
    expect(screenPath("ambiguous")).toBe("/unclear");
    expect(screenFromPath("/github")).toBe("github");
    expect(screenFromPath("/authorize")).toBe("authorize");
    expect(screenFromPath("/connected")).toBe("connected");
    expect(screenFromPath("/integrations")).toBe("integrations");
  });

  it("treats an unknown path as the dashboard", () => {
    expect(screenFromPath("")).toBe("dashboard");
    expect(screenFromPath("/missing")).toBe("dashboard");
  });

  it("reads the browser history index so Back is available after a push", () => {
    expect(historyIndex(null)).toBe(0);
    expect(historyIndex({ index: 0 })).toBe(0);
    expect(historyIndex({ index: 2 })).toBe(2);
    expect(historyIndex({ idx: 1 })).toBe(1);
    expect(historyIndex({ index: "2" })).toBe(0);
  });
});

describe("sandbox page shell", () => {
  it("renders the current page inside the shared frame", () => {
    const html = renderToStaticMarkup(
      createElement(SandboxApp, {
        productRef: createRef<HTMLDivElement>(),
        onInteraction: () => undefined,
        onPage: () => undefined,
        children: createElement(Dashboard, {
          onOpenSettings: () => undefined,
          onOpenApiKeys: () => undefined,
        }),
      }),
    );
    expect(html).toContain("Back");
    expect(html).toContain("Dashboard");
    expect(html).toContain("Open Settings");
  });
});
