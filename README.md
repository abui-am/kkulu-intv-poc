# Screen-aware voice agent

Interview prototype for a live agent that helps someone connect GitHub inside a fake SaaS app. The agent hears the user, watches a shared window, and keeps an explicit world model of the session. A decision is spoken only when it still matches the latest semantic screen.

## Run

```bash
pnpm install
cp .env.example .env.local
# set OPENAI_API_KEY in .env.local
pnpm dev
```

Open [the app](http://localhost:3000/). Start the session from the floating agent card. Chrome captures the current tab and keeps that card out of the screenshot. Say that you want to connect GitHub.

The same page owns the microphone and the cropped capture. If the tab closes, media stops; reopening it starts a fresh session that catches up from a new screenshot. `/sandbox` and `/session` redirect here.

The API key stays on the server. The browser receives only a short-lived Realtime credential for `gpt-live-transcribe`.

## Loop

Local frame differencing decides when the screen deserves a look. A short stable window drops loading frames, and bounded periodic checks catch small changes while guidance is pending. Sandbox button clicks show a three-dot notice on the floating agent and trigger a fresh shared-screen read. The guide waits for the screenshot before claiming the next page, and reports when a click leaves the shared window unchanged. Scripted guide lines are prepared when the session starts and play from memory; other lines stream as PCM. `gpt-6-luna` turns screenshots into `ScreenState` observations. The observed screen advances the workflow. The GitHub guide prescribes one action for each known page, checks that its target control is visible and enabled, and speaks navigation instructions directly. If a screenshot misses an intermediate page, that milestone is marked as unseen. Returning to an earlier page changes the instruction without erasing reached progress. A Connected result needs a visible success cue and a second fresh screenshot before completion. The LLM answers side questions, after which code appends the exact current guide. If screen reading fails, action guidance pauses until a clear observation arrives. If sharing ends, listening stops after the reconnect notice and resumes when the window is shared again.

The optional MobileDreamer-style lookahead remains available in the code but is bypassed for this fixed GitHub guide. The agent does not execute UI actions. Side questions use the LLM; navigation, loading, unclear screens, and reconnect instructions come from the fixed guide. The user performs each action and the next observed screen verifies progress.

After a guided instruction, the agent captures a transition specification and the current screen. When the next stable, meaningful screen arrives, a structured reflector compares BEFORE and AFTER screenshots with the intended action, precondition, postcondition, and up to five recent transitions in the same workflow step. Its verdict and rationale appear in the debug panel as diagnostic evidence. A reflection mismatch does not veto progress established by recognized screen evidence. This adapts the StepReflect paper's transition-level interface using the app's configured vision model; it does not load the paper's separately trained 8B model.

The live debug trace stays in memory. Use **Debug** on the agent card, then **Export debug trace**, to download it. Exports include conversation text and screen descriptions; raw screenshots are excluded unless you select **Include raw screenshots**.

## Checks

```bash
pnpm test
```

Unit tests cover the reducer, workflow verifier, stale-decision validator, and context builder. Live scenarios — happy path, API Keys, a stale instruction, a side question, barge-in, the one-second integrations loader, hover or clock noise, and the unclear screen — are exercised in the one-tab app. The debug panel is the trace.
