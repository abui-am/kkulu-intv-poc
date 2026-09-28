export type Story = {
  invitesSent: boolean;
  tokenSaved: boolean;
  slackBlocked: boolean;
  hubspotRequested: boolean;
  installRejected: boolean;
  accessDenied: boolean;
  githubConnected: boolean;
};

export const emptyStory: Story = {
  invitesSent: false,
  tokenSaved: false,
  slackBlocked: false,
  hubspotRequested: false,
  installRejected: false,
  accessDenied: false,
  githubConnected: false,
};

export function remember(story: Story, fact: keyof Story): Story {
  return story[fact] ? story : { ...story, [fact]: true };
}

export function storyNotes(story: Story): string[] {
  const notes = [story.githubConnected ? "GitHub is connected" : "GitHub is not connected"];
  if (story.tokenSaved) notes.push("API token saved");
  if (story.invitesSent) notes.push("Team invites sent");
  if (story.slackBlocked) notes.push("Slack blocked");
  if (story.hubspotRequested) notes.push("HubSpot requested");
  if (story.installRejected) notes.push("Full install rejected");
  if (story.accessDenied) notes.push("Full access denied");
  return notes;
}
