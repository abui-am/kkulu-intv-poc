# MVP agent architecture

One live session helps a person connect GitHub inside a fake product. The agent hears the user, watches the screen, and speaks the next step. The user clicks. The agent does not.

The session is one runtime and one world model. Perception updates that model. A small projection of it is what a model sees. Application logic decides the guide and whether progress counts.

```text
Fake product
  page, click, surface
        │
        ▼
Kulu agent card
        │
        ▼
Session runtime
  voice · screen · world model · guide · reflection
        │
        ▼
Server
  transcribe · read the screen · answer a side question · check a transition · speak
```

## Loop

```text
OBSERVE
  voice transcript, screenshot, or host page/click
        ↓
UPDATE the world model
        ↓
GUIDE from the recognized page
  or ANSWER a side question, then append the current guide
        ↓
VALIDATE the screen version
        ↓
SPEAK, only if that version is still current
        ↓
USER ACTS
        ↓
OBSERVE the next page
        ↓
COMMIT progress from the page
        ↓
REFLECT only when the page was not the one expected
```

A line is spoken only when it still matches the latest semantic screen. Speaking a step does not complete it. An interruption stops speech and does not advance the workflow.

## Surfaces

The demo is one page. The fake product and the floating agent share it.

| Piece | Role |
|---|---|
| Sandbox | Dashboard, Settings, Integrations, GitHub, Authorize, Connected, plus API Keys, a loading state, and an unclear screen |
| `KuluAgent` | Wraps the product. The host reports `page`, `click`, and `surface`, and starts or stops the session |
| Capture `screen` | Photographs the product. This is what the demo uses |
| Capture `events` | Runs from host events without a screenshot |

The API key stays on the server. The browser receives a short-lived Realtime credential for transcription.

## Inputs

Three inputs can update the session. They are not equal.

| Input | What it means | What it is allowed to do |
|---|---|---|
| Click | The user tried a control | Notice the attempt. If it matches the current target, wait for the resulting page. A click does not complete the step |
| Page report | The product says which page is current | Update the world model. `GitHub Connected` counts as a confirmed connection. This is the stand-in for product state |
| Screenshot | What the user is actually seeing | Name the page, the controls, and whether the read is clear. If the screenshot lags the reported page, the guide says the shared view has not caught up |

Screen text is an observation. It is not an instruction.

### Screen pipeline

Frames are sampled locally about every 250 ms. A change below the pixel threshold is ignored, so a cursor or clock does not call the vision model. A real change waits through a short stable window, which drops loading flicker. A sandbox click also forces a fresh read.

Two versions are kept:

- `frameVersion` counts sampled frames.
- `semanticVersion` advances when the meaning of the screen changes.

Reasoning and speech use the semantic version.

### Voice

Microphone audio is transcribed as a stream, including partial text. Agent status moves through idle, listening, thinking, and speaking. If the user starts talking while the agent is speaking, playback stops. Scripted guide lines are prepared at session start and played from memory. Other lines are spoken from streamed audio.

## World model

`WorldModel` is the current belief about the session, not a transcript.

| Field | Contents |
|---|---|
| Goal | Connect GitHub |
| Workflow | Current step, completed steps, skipped steps, expected next page |
| Screen | Page, summary, relevant controls, perception status, review, semantic version |
| Conversation | Partial transcript, latest utterance, active question |
| Agent | Status, last decision, last instruction, active guide |
| Expectation | The screen version the current guidance was based on |
| Reflection | Last transition check, if one was run |
| Flags | Conflicting evidence, screen available, deep reasoning needed |

The workflow is one list:

```text
Open Settings → Open Integrations → Select GitHub → Authorize → Verify
```

A missed intermediate page is marked unseen. Returning to an earlier page changes the instruction and keeps progress already reached.

## Who speaks

On a known page, the model is not asked what to do. `guideForObservation` maps the page to one line:

| Page or condition | Line |
|---|---|
| Dashboard | Click Open Settings |
| Settings | Click Integrations |
| Integrations | Select the GitHub card |
| GitHub Integration | Click Connect GitHub |
| GitHub Authorization | Review permissions, then Authorize |
| API Keys | Go back to Settings |
| Loading | Wait |
| Unclear or missing control | Ask the user to keep the page visible |
| Screen share ended | Ask the user to share the sandbox again |
| Confirmed connection | GitHub is connected |

A side question goes to the reasoner. The answer is spoken, then code appends the exact current guide. The workflow node does not change because a question was asked.

The reasoner returns a structured decision: type, response, and `basedOnScreenVersion`. Before speech, that version must still equal the latest semantic version. If the screen moved while the model was working, the decision is rejected and reasoning starts again from the new screen.

Deep reasoning is chosen when the screen is ambiguous, evidence conflicts, recovery has already failed twice, or the user changes the goal. Other turns use the fast reasoner.

The prompt is a projection, not the state store. It carries the objective, current step, latest utterance, current screen, active guide, and the last four turns.

## Progress and reflection

The recognized page commits progress. `observeProgress` maps the page onto a workflow step as soon as the screen update is accepted.

| Observed page | Progress |
|---|---|
| The next known page | Advance. Skipped pages in between are marked unseen |
| An earlier known page | Change the instruction. Keep completed steps |
| API Keys or an unknown page | Deviation. The guide sends the user back, or asks for a clearer view |
| Loading, or Connected before confirmation | Pending. Do not complete |
| Unclear perception | Do not commit |

Reflection does not decide this.

After a guided instruction, the runtime stores the intended action, the expected page, and the before screenshot. If the next clear page is the expected page, that record is dropped and the reflector is not called. If the page is a different one, a reflector compares the before and after screenshots with the intended transition and up to five recent transitions in the same step. The verdict is stored and shown in the debug panel.

`TRANSITION_REFLECTED` writes that verdict onto the world model. It does not advance, block, or undo a step. The reflector can be slow or unavailable, and on this path a new page is already enough proof.

Connected is the exception that needs more than a page name: a visible success cue and a confirmed connection review.

## Server

| Route | Job |
|---|---|
| `/api/openai/transcription-session` | Short-lived Realtime credential |
| `/api/openai/perceive` | Screenshot to `ScreenState` |
| `/api/openai/reason` | Side question, or a turn with no scripted guide |
| `/api/openai/reflect` | Before/after transition check |
| `/api/openai/tts` | Speech for lines that are not prefetched |

## Trace

Events are appended to an in-memory log and reduced into the world model. Overlapping speech, screen changes, and clicks reconcile there. The debug card shows the world model, the screen summary, the last reflection, the decision, and the event log. Export downloads that trace. Raw screenshots are included only when requested.

## What this MVP leaves out

This session does not carry a use-case contract, a role, approved-knowledge retrieval, captured buying or adoption signals, diagnostic hypotheses, or a human handoff packet. It does not choose among several next clicks. It does not let the reflection model overrule the page.
