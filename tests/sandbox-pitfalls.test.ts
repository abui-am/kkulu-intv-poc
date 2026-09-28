import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ApiKeys } from "@/components/sandbox/ApiKeys";
import { Dashboard } from "@/components/sandbox/Dashboard";
import { GithubAuthorization } from "@/components/sandbox/GithubAuthorization";
import { GithubIntegration } from "@/components/sandbox/GithubIntegration";
import { Integrations } from "@/components/sandbox/Integrations";
import { Settings } from "@/components/sandbox/Settings";

describe("sandbox pitfalls", () => {
  it("puts a louder wrong setup in front of Open Settings", () => {
    const html = renderToStaticMarkup(createElement(Dashboard, {
      onOpenSettings: () => undefined,
      onOpenApiKeys: () => undefined,
    }));
    expect(html.indexOf("Create an API token")).toBeLessThan(html.indexOf("Open Settings"));
    expect(html).toContain("Invite team");
  });

  it("offers a token shortcut beside Integrations", () => {
    const html = renderToStaticMarkup(createElement(Settings, {
      onOpenIntegrations: () => undefined,
      onOpenApiKeys: () => undefined,
    }));
    expect(html).toContain("Create token");
    expect(html).toContain("Integrations");
    expect(html).toContain("Billing");
  });

  it("features Slack ahead of the GitHub card", () => {
    const html = renderToStaticMarkup(createElement(Integrations, { onSelectGithub: () => undefined }));
    expect(html.indexOf("Slack")).toBeLessThan(html.indexOf(">GitHub<"));
    expect(html).toContain("POPULAR");
  });

  it("makes the broad GitHub install look like the primary action", () => {
    const html = renderToStaticMarkup(createElement(GithubIntegration, { onConnect: () => undefined }));
    expect(html.indexOf("Install on all repositories")).toBeLessThan(html.indexOf("Connect GitHub"));
  });

  it("makes full repository access look safer than Authorize", () => {
    const html = renderToStaticMarkup(createElement(GithubAuthorization, { onAuthorize: () => undefined }));
    expect(html.indexOf("Allow every private repository")).toBeLessThan(html.indexOf("Authorize"));
  });

  it("lets a saved token look finished without saying GitHub is connected", () => {
    const html = renderToStaticMarkup(createElement(ApiKeys));
    expect(html).toContain("Create GitHub token");
    expect(html).not.toContain("GitHub Connected");
  });
});
