# Screen-aware voice agent

Interview prototype for a live agent that helps someone connect GitHub inside a fake SaaS app. The agent hears the user, watches a shared window, and keeps an explicit world model of the session. A decision is spoken only when it still matches the latest semantic screen.

## Run

```bash
pnpm install
cp .env.example .env.local
# set OPENAI_API_KEY in .env.local
pnpm dev
```

Open [the sandbox](http://localhost:3000/sandbox) in one window and [the agent](http://localhost:3000/session) in another. Start the session, share the sandbox window, and say that you want to connect GitHub.

The API key stays on the server. The browser receives only a short-lived Realtime credential for `gpt-live-transcribe`.

## Loop

Local frame differencing decides when the screen deserves a look. A short stable window drops loading frames. `gpt-6-luna` turns one screenshot into a `ScreenState`. The workflow verifier, not the model, marks a step complete. `gpt-6-luna` proposes the next line; `gpt-6-sol` is used only for ambiguity, conflicting evidence, repeated recovery failure, a changed goal, or a decision that asks for a deeper pass. If the semantic screen version moves while a decision is in flight, that decision is rejected and the agent replans.

## Checks

```bash
pnpm test
```

Unit tests cover the reducer, workflow verifier, stale-decision validator, and context builder. Live scenarios — happy path, API Keys, a stale instruction, a side question, barge-in, the one-second integrations loader, hover or clock noise, and the unclear screen — are exercised in the two windows. The debug panel is the trace.
