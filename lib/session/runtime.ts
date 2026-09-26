import { buildReasoningContext } from "@/lib/agent/context-builder";
import { isLookaheadEligible } from "@/lib/agent/lookahead";
import { detectGoalChange } from "@/lib/agent/router";
import { requestDecision } from "@/lib/agent/reasoner";
import { validateDecision } from "@/lib/agent/validator";
import { dispatch, type SessionLog } from "@/lib/events/dispatcher";
import type { SessionEvent } from "@/lib/events/types";
import { PIXEL_CHANGE_THRESHOLD, SCREEN_SAMPLE_INTERVAL_MS, STABLE_WINDOW_MS } from "@/lib/screen/config";
import { captureJpeg, sampleLuminance } from "@/lib/screen/capture";
import { changeRatio } from "@/lib/screen/frame-diff";
import { nextSemanticVersion, resolveSemanticChange } from "@/lib/screen/perception";
import { Stabilizer } from "@/lib/screen/stabilizer";
import { ScreenStateSchema } from "@/schemas/screen-state";
import { createMetrics, type SessionMetrics } from "@/lib/session/metrics";
import { verifyObservation } from "@/lib/workflow/verifier";
import { createInitialWorldModel } from "@/lib/world/initial-state";
import type { WorldModel } from "@/lib/world/types";
import type { TraceEntry } from "@/lib/session/trace-html";
import { EnergyVad } from "@/lib/voice/vad";
import { SpeechPlayback } from "@/lib/voice/playback";
import { RealtimeTranscription } from "@/lib/voice/realtime-transcription";
import type { DenoisedMicrophone } from "@/lib/voice/noise-suppressor";
import type { Rollout } from "@/schemas/lookahead";

export type SessionSnapshot = {
  world: WorldModel;
  events: SessionEvent[];
  metrics: SessionMetrics;
  recentTurns: string[];
  error: string | null;
  screenSharing: boolean;
  hearing: boolean;
  ended: boolean;
  logFile: string | null;
  rollout: Rollout | null;
};

const FALLBACK_SPEECH = "I lost context for a second. Give me one moment.";
const MAX_STALE_RETRIES = 3;

export class SessionRuntime {
  private log: SessionLog;
  private metrics: SessionMetrics;
  private recentTurns: string[] = [];
  private error: string | null = null;
  private ended = false;
  private screenSharing = false;
  private hearing = false;
  private microphone: DenoisedMicrophone | null = null;
  private trace: TraceEntry[] = [];
  private logFile: string | null = null;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private shotForNextEvent: string | null = null;
  private video: HTMLVideoElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private screenStream: MediaStream | null = null;
  private sampleTimer: ReturnType<typeof setInterval> | null = null;
  private previousFrame: Uint8Array | null = null;
  private frameVersion = 0;
  private stabilizer: Stabilizer | null = null;
  private perceptionToken = 0;
  private reasoningToken = 0;
  private staleRetries = 0;
  private discrepancy: { expected: string; observed: string } | undefined;
  private playback = new SpeechPlayback();
  private transcription: RealtimeTranscription | null = null;
  private vad: EnergyVad | null = null;
  private audioContext: AudioContext | null = null;
  private activeDecisionId: string | null = null;
  private perceptionRetries = new Map<string, number>();
  private previousPage: string | null = null;
  private rollout: Rollout | null = null;
  private reasoningController: AbortController | null = null;

  constructor(private readonly publish: (snapshot: SessionSnapshot) => void) {
    const sessionId = crypto.randomUUID();
    this.log = { world: createInitialWorldModel(sessionId), events: [] };
    this.metrics = createMetrics();
  }

  private levelListener: ((level: number) => void) | null = null;

  subscribeLevel(listener: (level: number) => void): () => void {
    this.levelListener = listener;
    return () => {
      if (this.levelListener === listener) this.levelListener = null;
    };
  }

  snapshot(): SessionSnapshot {
    return {
      world: this.log.world,
      events: this.log.events,
      metrics: this.metrics,
      recentTurns: this.recentTurns,
      error: this.error,
      screenSharing: this.screenSharing,
      hearing: this.hearing,
      ended: this.ended,
      logFile: this.logFile,
      rollout: this.rollout,
    };
  }

  start(): void {
    this.ended = false;
    this.metrics = createMetrics();
    this.apply({ type: "SESSION_STARTED", at: Date.now() });
    void this.startVoice();
  }

  async shareScreen(video: HTMLVideoElement, canvas: HTMLCanvasElement): Promise<void> {
    this.video = video;
    this.canvas = canvas;
    const previous = this.screenStream;
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
    this.screenStream = stream;
    previous?.getTracks().forEach((track) => track.stop());
    video.srcObject = stream;
    await video.play();
    this.screenSharing = true;
    this.error = null;
    const track = stream.getVideoTracks()[0];
    track.onended = () => {
      if (this.screenStream !== stream) return;
      this.markScreenUnavailable();
    };
    this.previousFrame = null;
    this.stabilizer?.cancel();
    this.stabilizer = new Stabilizer(STABLE_WINDOW_MS, () => {
      void this.perceiveStableFrame();
    });
    this.stabilizer.bump();
    if (this.sampleTimer) clearInterval(this.sampleTimer);
    this.sampleTimer = setInterval(() => this.sampleFrame(), SCREEN_SAMPLE_INTERVAL_MS);
    this.publish(this.snapshot());
  }

  stop(): void {
    this.ended = true;
    this.reasoningToken += 1;
    this.perceptionToken += 1;
    this.reasoningController?.abort();
    this.reasoningController = null;
    if (this.sampleTimer) clearInterval(this.sampleTimer);
    this.stabilizer?.cancel();
    this.playback.stop();
    this.transcription?.stop();
    this.vad?.stop();
    this.microphone?.close();
    this.microphone = null;
    this.hearing = false;
    this.audioContext = null;
    this.screenStream?.getTracks().forEach((track) => track.stop());
    this.screenSharing = false;
    this.log = {
      ...this.log,
      world: {
        ...this.log.world,
        agent: { ...this.log.world.agent, status: "idle" },
      },
    };
    this.publish(this.snapshot());
    void this.flushTrace();
  }

  reset(): void {
    this.stop();
    const sessionId = crypto.randomUUID();
    this.log = { world: createInitialWorldModel(sessionId), events: [] };
    this.metrics = createMetrics();
    this.recentTurns = [];
    this.error = null;
    this.ended = false;
    this.discrepancy = undefined;
    this.trace = [];
    this.logFile = null;
    this.rollout = null;
    this.publish(this.snapshot());
  }

  private apply(event: SessionEvent): void {
    const previousAttempts = this.log.world.workflow.recoveryAttempts;
    const previousSemantic = this.log.world.screen.semanticVersion;
    this.log = dispatch(this.log, event);
    if (event.type === "FRAME_SAMPLED" && event.changeRatio < PIXEL_CHANGE_THRESHOLD) {
      this.metrics.ignoredFrameChanges += 1;
    }
    if (event.type === "SCREEN_STATE_UPDATED" && event.semanticVersion > previousSemantic) {
      this.metrics.semanticScreenChanges += 1;
    }
    if (event.type === "DECISION_REJECTED_STALE") this.metrics.staleDecisionsRejected += 1;
    if (event.type === "WORKFLOW_DEVIATION") this.metrics.workflowDeviations += 1;
    if (event.type === "WORKFLOW_STEP_VERIFIED" && previousAttempts > 0) {
      this.metrics.successfulRecoveries += 1;
    }
    if (event.type === "AGENT_INTERRUPTED") this.metrics.interruptions += 1;
    if (event.type === "LOOKAHEAD_RESULT") {
      this.metrics.lookaheadRuns += event.status === "bypassed" ? 0 : 1;
      this.metrics.lookaheadFallbacks += event.status === "fallback" ? 1 : 0;
      this.metrics.lookaheadBranches += event.validBranchCount;
      this.metrics.lookaheadModelCalls += event.modelCalls;
      if (event.status !== "bypassed") this.metrics.lookaheadLatenciesMs.push(event.latencyMs);
    }
    this.record(event);
    this.publish(this.snapshot());
  }

  private record(event: SessionEvent): void {
    const screenshot = this.shotForNextEvent;
    this.shotForNextEvent = null;
    this.trace.push({
      at: "at" in event ? event.at : Date.now(),
      event: event.type,
      detail: traceDetail(event),
      state: JSON.stringify(
        {
          world: this.log.world,
          hearing: this.hearing,
          error: this.error,
          metrics: this.metrics,
          recentTurns: this.recentTurns,
          rollout: this.rollout,
        },
        null,
        2,
      ),
      screenshot,
    });
    this.scheduleFlush();
  }

  private scheduleFlush(): void {
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = setTimeout(() => {
      void this.flushTrace();
    }, 800);
  }

  private async flushTrace(): Promise<void> {
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = null;
    const sessionId = this.log.world.sessionId;
    const entries = this.trace.slice();
    if (!entries.length) return;
    try {
      const response = await fetch("/api/session-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          entries,
        }),
      });
      const payload: unknown = await response.json();
      if (!response.ok) return;
      this.logFile = (payload as { file?: string }).file ?? this.logFile;
      this.publish(this.snapshot());
    } catch {
      this.error = "Session log could not be saved.";
      this.publish(this.snapshot());
    }
  }

  private sampleFrame(): void {
    if (!this.video || !this.canvas) return;
    const frame = sampleLuminance(this.video, this.canvas);
    if (!frame) return;
    this.frameVersion += 1;
    const ratio = this.previousFrame ? changeRatio(this.previousFrame, frame) : 1;
    this.previousFrame = frame;
    this.apply({
      type: "FRAME_SAMPLED",
      frameVersion: this.frameVersion,
      changeRatio: ratio,
      at: Date.now(),
    });
    if (ratio < PIXEL_CHANGE_THRESHOLD) return;
    this.apply({ type: "SCREEN_CHANGE_CANDIDATE", at: Date.now() });
    this.stabilizer?.bump();
  }

  private async perceiveStableFrame(): Promise<void> {
    if (!this.video) return;
    const image = captureJpeg(this.video);
    if (!image) return;
    const imageId = `frame-${this.frameVersion}-${Date.now()}`;
    this.shotForNextEvent = image;
    this.apply({ type: "SCREEN_STABILIZED", imageId, at: Date.now() });
    const token = ++this.perceptionToken;
    await this.perceive(image, imageId, token, true);
  }

  private async perceive(image: string, imageId: string, token: number, allowRetry: boolean): Promise<void> {
    const started = Date.now();
    this.metrics.visionCalls += 1;
    try {
      const response = await fetch("/api/openai/perceive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageDataUrl: image,
          currentStep: this.log.world.workflow.currentStep,
          expectedNextState: this.log.world.workflow.expectedNextState,
          previousScreenSummary: this.log.world.screen.summary,
        }),
      });
      const payload: unknown = await response.json();
      if (token !== this.perceptionToken) return;
      if (!response.ok) throw new Error("Perception failed");
      const screen = ScreenStateSchema.parse((payload as { screen: unknown }).screen);
      this.metrics.perceptionLatenciesMs.push(Date.now() - started);
      const previousPage = this.log.world.screen.page;
      const semanticChange = resolveSemanticChange({
        reported: screen.semanticChange,
        previousPage,
        nextPage: screen.page,
      });
      this.previousPage = previousPage;
      const previousSemantic = this.log.world.screen.semanticVersion;
      const semanticVersion = nextSemanticVersion(previousSemantic, semanticChange);
      this.apply({
        type: "SCREEN_STATE_UPDATED",
        screen: { ...screen, semanticChange },
        semanticVersion,
        at: Date.now(),
      });
      this.afterScreenUpdate(semanticVersion > previousSemantic);
    } catch {
      if (token !== this.perceptionToken) return;
      const attempts = this.perceptionRetries.get(imageId) ?? 0;
      if (allowRetry && attempts < 1) {
        this.perceptionRetries.set(imageId, attempts + 1);
        await this.perceive(image, imageId, token, false);
        return;
      }
      this.error = "I couldn't read the screen. I'll keep the last clear view.";
      this.publish(this.snapshot());
    }
  }

  private afterScreenUpdate(semanticChanged: boolean): void {
    const world = this.log.world;
    const result = verifyObservation({
      currentStep: world.workflow.currentStep,
      observedPage: world.screen.page,
      perceptionStatus: world.screen.perceptionStatus,
    });
    if (result.outcome === "match") {
      this.discrepancy = undefined;
      this.apply({ type: "WORKFLOW_STEP_VERIFIED", stepId: result.stepId, at: Date.now() });
    } else if (result.outcome === "deviation") {
      this.discrepancy = { expected: result.expected, observed: result.observed };
      this.apply({
        type: "WORKFLOW_DEVIATION",
        expected: result.expected,
        observed: result.observed,
        at: Date.now(),
      });
    } else {
      this.discrepancy = undefined;
    }
    const shouldReason =
      semanticChanged || result.outcome === "deviation" || result.outcome === "ambiguous";
    if (shouldReason && this.log.world.agent.status !== "idle") void this.reason("screen");
  }

  private async reason(trigger: string): Promise<void> {
    if (!this.screenSharing && trigger === "screen") return;
    const token = ++this.reasoningToken;
    this.reasoningController?.abort();
    const controller = new AbortController();
    this.reasoningController = controller;
    this.rollout = null;
    const world = this.log.world;
    const reasoningStartedAt = Date.now();
    this.apply({
      type: "REASONING_STARTED",
      basedOnScreenVersion: world.screen.semanticVersion,
      at: Date.now(),
    });
    const imageDataUrl = this.screenSharing && this.video ? captureJpeg(this.video) ?? undefined : undefined;
    const context = buildReasoningContext(world, this.recentTurns, this.discrepancy, this.previousPage);
    const signals = {
      perceptionStatus: world.screen.perceptionStatus,
      conflictingEvidence: world.flags.conflictingEvidence,
      recoveryAttempts: world.workflow.recoveryAttempts,
      userChangedGoal: detectGoalChange(world.conversation.latestUserUtterance),
    };
    if (imageDataUrl && isLookaheadEligible(context, signals)) {
      this.apply({
        type: "LOOKAHEAD_STARTED",
        basedOnScreenVersion: world.screen.semanticVersion,
        at: Date.now(),
      });
    }
    try {
      const result = await requestDecision({
        context,
        signals,
        imageDataUrl,
        allowLookahead: true,
        signal: controller.signal,
      });
      if (token !== this.reasoningToken) return;
      this.metrics.reasoningLatenciesMs.push(Date.now() - reasoningStartedAt);
      if (result.model === "deep") this.metrics.deepReasonerCalls += 1;
      else this.metrics.fastReasonerCalls += 1;
      this.rollout = result.rollout;
      if (result.rollout) {
        this.apply({
          type: "LOOKAHEAD_RESULT",
          basedOnScreenVersion: result.rollout.basedOnScreenVersion,
          status: result.rollout.status,
          candidateCount: result.rollout.candidateCount,
          validBranchCount: result.rollout.branches.filter((branch) => branch.valid).length,
          modelCalls: result.rollout.modelCalls,
          latencyMs: result.rollout.latencyMs,
          reason: result.rollout.fallbackReason,
          at: Date.now(),
        });
      }
      const verdict = validateDecision(result.decision, this.log.world.screen.semanticVersion);
      if (!verdict.ok) {
        this.apply({
          type: "DECISION_REJECTED_STALE",
          decisionId: verdict.decisionId,
          currentScreenVersion: verdict.currentScreenVersion,
          at: Date.now(),
        });
        if (this.staleRetries < MAX_STALE_RETRIES) {
          this.staleRetries += 1;
          await this.reason("stale");
        }
        return;
      }
      this.staleRetries = 0;
      this.apply({ type: "DECISION_READY", decision: result.decision, at: Date.now() });
      this.recentTurns = [...this.recentTurns, `Assistant: ${result.decision.response}`].slice(-4);
      if (result.decision.type === "wait" || !result.decision.response.trim()) return;
      await this.speak(result.decision.id, result.decision.response, result.decision.basedOnScreenVersion);
    } catch {
      if (token !== this.reasoningToken) return;
      this.error = FALLBACK_SPEECH;
      this.recentTurns = [...this.recentTurns, `Assistant: ${FALLBACK_SPEECH}`].slice(-4);
      this.publish(this.snapshot());
      await this.speak(null, FALLBACK_SPEECH, this.log.world.screen.semanticVersion);
    } finally {
      if (this.reasoningController === controller) this.reasoningController = null;
    }
  }

  private async speak(decisionId: string | null, text: string, basedOnScreenVersion: number): Promise<void> {
    if (basedOnScreenVersion !== this.log.world.screen.semanticVersion) {
      this.apply({
        type: "DECISION_REJECTED_STALE",
        decisionId: decisionId ?? "fallback",
        currentScreenVersion: this.log.world.screen.semanticVersion,
        at: Date.now(),
      });
      return;
    }
    this.playback.stop();
    this.activeDecisionId = decisionId;
    if (decisionId) {
      this.apply({ type: "AGENT_SPEECH_STARTED", decisionId, at: Date.now() });
    }
    try {
      const response = await fetch("/api/openai/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!response.ok) throw new Error("TTS failed");
      if (this.activeDecisionId !== decisionId || basedOnScreenVersion !== this.log.world.screen.semanticVersion) return;
      const blob = await response.blob();
      if (this.activeDecisionId !== decisionId || basedOnScreenVersion !== this.log.world.screen.semanticVersion) return;
      await this.playback.play(blob);
      if (this.log.world.agent.status === "speaking") {
        this.log = {
          ...this.log,
          world: {
            ...this.log.world,
            agent: { ...this.log.world.agent, status: "listening" },
          },
        };
        this.publish(this.snapshot());
      }
    } catch {
      this.error = text;
      this.publish(this.snapshot());
    }
  }

  private interrupt(): void {
    if (this.log.world.agent.status !== "speaking" && !this.playback.playing) return;
    this.playback.stop();
    this.apply({
      type: "AGENT_INTERRUPTED",
      decisionId: this.activeDecisionId,
      at: Date.now(),
    });
    this.activeDecisionId = null;
  }

  private async startVoice(): Promise<void> {
    try {
      this.transcription = new RealtimeTranscription({
        onPartial: (text, itemId) => {
          this.apply({ type: "USER_TRANSCRIPT_PARTIAL", text, itemId, at: Date.now() });
        },
        onFinal: (text, itemId) => {
          this.apply({ type: "USER_TRANSCRIPT_FINAL", text, itemId, at: Date.now() });
          this.recentTurns = [...this.recentTurns, `User: ${text}`].slice(-4);
          void this.reason("speech");
        },
        onError: (message) => {
          this.error = message;
          this.publish(this.snapshot());
        },
      });
      const { openDenoisedMicrophone } = await import("@/lib/voice/noise-suppressor");
      this.microphone = await openDenoisedMicrophone();
      this.audioContext = this.microphone.context;
      const connection = await this.transcription.connect(this.microphone.stream, {
        commit: () => undefined,
      });
      const source = this.audioContext.createMediaStreamSource(this.microphone.stream);
      const analyser = this.audioContext.createAnalyser();
      analyser.fftSize = 1024;
      source.connect(analyser);
      this.vad = new EnergyVad(analyser, {
        onLevel: (rms) => {
          this.levelListener?.(Math.max(0, Math.min(1, rms / 0.12)));
        },
        onSpeechStart: () => {
          this.hearing = true;
          this.interrupt();
          this.apply({ type: "USER_SPEECH_STARTED", at: Date.now() });
        },
        onSpeechEnd: () => {
          this.hearing = false;
          this.levelListener?.(0);
          this.publish(this.snapshot());
          connection.commit();
        },
      });
      this.vad.start();
    } catch (error) {
      this.microphone?.close();
      this.microphone = null;
      this.error = error instanceof Error ? error.message : "Microphone connection failed";
      this.publish(this.snapshot());
    }
  }

  private markScreenUnavailable(): void {
    this.previousPage = this.log.world.screen.page ?? this.previousPage;
    this.screenSharing = false;
    if (this.sampleTimer) clearInterval(this.sampleTimer);
    this.stabilizer?.cancel();
    this.apply({ type: "SCREEN_UNAVAILABLE", at: Date.now() });
    this.error = "Screen sharing stopped. Share the sandbox window to continue.";
    this.publish(this.snapshot());
    if (!this.ended && this.log.world.agent.status !== "idle") void this.reason("unavailable");
  }
}

function traceDetail(event: SessionEvent): string {
  switch (event.type) {
    case "USER_TRANSCRIPT_PARTIAL":
    case "USER_TRANSCRIPT_FINAL":
      return event.text;
    case "FRAME_SAMPLED":
      return `v${event.frameVersion} Δ${event.changeRatio.toFixed(3)}`;
    case "SCREEN_STABILIZED":
      return event.imageId;
    case "SCREEN_STATE_UPDATED":
      return `${event.screen.page} v${event.semanticVersion}`;
    case "REASONING_STARTED":
      return `v${event.basedOnScreenVersion}`;
    case "LOOKAHEAD_STARTED":
      return `v${event.basedOnScreenVersion}`;
    case "LOOKAHEAD_RESULT":
      return `${event.status} ${event.validBranchCount}/${event.candidateCount} branches, ${event.modelCalls} model calls`;
    case "DECISION_READY":
      return `${event.decision.type}: ${event.decision.response}`;
    case "DECISION_REJECTED_STALE":
      return `${event.decisionId} current v${event.currentScreenVersion}`;
    case "WORKFLOW_STEP_VERIFIED":
      return event.stepId;
    case "WORKFLOW_DEVIATION":
      return `expected ${event.expected}, observed ${event.observed}`;
    case "AGENT_SPEECH_STARTED":
    case "AGENT_INTERRUPTED":
      return event.decisionId ?? "";
    default:
      return "";
  }
}
