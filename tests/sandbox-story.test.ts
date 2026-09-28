import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Dashboard } from "@/components/sandbox/Dashboard";
import { emptyStory, remember, storyNotes } from "@/components/sandbox/story";

describe("sandbox story", () => {
  it("keeps each wrong turn when the user leaves the screen", () => {
    let story = emptyStory;
    story = remember(story, "invitesSent");
    story = remember(story, "tokenSaved");
    story = remember(story, "slackBlocked");
    expect(storyNotes(story)).toEqual([
      "GitHub is not connected",
      "API token saved",
      "Team invites sent",
      "Slack blocked",
    ]);
  });

  it("changes the workspace line only after GitHub is actually authorized", () => {
    const withToken = remember(emptyStory, "tokenSaved");
    expect(storyNotes(withToken)[0]).toBe("GitHub is not connected");
    expect(storyNotes(remember(withToken, "githubConnected"))[0]).toBe("GitHub is connected");
  });

  it("rewrites the dashboard after a token is saved", () => {
    const html = renderToStaticMarkup(createElement(Dashboard, {
      story: remember(emptyStory, "tokenSaved"),
      onOpenSettings: () => undefined,
      onOpenApiKeys: () => undefined,
    }));
    expect(html).toContain("The token is saved");
    expect(html).toContain("$1.2M");
    expect(html).not.toContain("Create an API token");
  });
});
