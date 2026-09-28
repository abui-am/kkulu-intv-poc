import { buildReasoningContext } from "@/lib/agent/context-builder";
import { fallbackGuideDecision, guidedDecision } from "@/lib/agent/guide-decision";
import { buildReflectionInput, createPendingTransition, type PendingTransition, type ReflectionAssessment } from "@/lib/agent/reflection";
import { detectGoalChange } from "@/lib/agent/router";
import { requestDecision } from "@/lib/agent/reasoner";
import { validateDecision } from "@/lib/agent/validator";
import { dispatch, type SessionLog } from "@/lib/events/dispatcher";
import type { SessionEvent } from "@/lib/events/types";
import { PIXEL_CHANGE_THRESHOLD, SCREEN_SAMPLE_INTERVAL_MS, STABLE_WINDOW_MS } from "@/lib/screen/config";
import { captureJpeg, sampleLuminance } from "@/lib/screen/capture";
import { entireScreenCaptureOptions } from "@/lib/screen/crop";
import { changeRatio } from "@/lib/screen/frame-diff";
import { nextSemanticVersion, resolveSemanticChange } from "@/lib/screen/perception";
import { Stabilizer } from "@/lib/screen/stabilizer";
import { ScreenStateSchema } from "@/schemas/screen-state";
import { createMetrics, type SessionMetrics } from "@/lib/session/metrics";
import { observeProgress } from "@/lib/workflow/progress";
import { actionForPage, clickMatchesTarget, connectedEvidence, outsideWindowInstruction, targetVisible, type ScreenReview } from "@/lib/workflow/guide";
import { canonicalizePage } from "@/lib/workflow/pages";
import { createInitialWorldModel } from "@/lib/world/initial-state";
import type { WorldModel } from "@/lib/world/types";
import { renderTraceHtml, type TraceEntry } from "@/lib/session/trace-html";
import { EnergyVad } from "@/lib/voice/vad";
import { SpeechPlayback } from "@/lib/voice/playback";
import { RealtimeTranscription } from "@/lib/voice/realtime-transcription";
import type { DenoisedMicrophone } from "@/lib/voice/noise-suppressor";
import type { Rollout } from "@/schemas/lookahead";
import { ReflectionResultSchema, type ReflectionInput, type TransitionRecord } from "@/schemas/reflection";

export type SessionSnapshot = {
  world: WorldModel;
  events: SessionEvent[];
  metrics: SessionMetrics;
  recentTurns: string[];
  error: string | null;
  screenSharing: boolean;
  sharedSurfaceLabel: string | null;
  hearing: boolean;
  ended: boolean;
  rollout: Rollout | null;
};

const FALLBACK_SPEECH = "I lost context for a second. Give me one moment.";
const MAX_STALE_RETRIES = 3;
const FORCED_CHECK_INTERVAL_MS = 3_000;
const MAX_FORCED_CHECKS = 4;

export class SessionRuntime {
  private log: SessionLog;
  private metrics: SessionMetrics;
  private recentTurns: string[] = [];
  private error: string | null = null;
  private ended = false;
  private acceptingHostEvents = false;
  private screenSharing = false;
  private sharedSurfaceLabel: string | null = null;
  private hearing = false;
  private microphone: DenoisedMicrophone | null = null;
  private trace: TraceEntry[] = [];
  private forceTimer: ReturnType<typeof setTimeout> | null = null;
  private shotForNextEvent: string | null = null;
  private video: HTMLVideoElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private latestJpeg: string | null = null;
  private screenStream: MediaStream | null = null;
  private shareToken = 0;
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
  private speechToken = 0;
  private perceptionRetries = new Map<string, number>();
  private previousPage: string | null = null;
  private rollout: Rollout | null = null;
  private reasoningController: AbortController | null = null;
  private currentScreenImage: string | null = null;
  private pendingTransition: PendingTransition | null = null;
  private transitionHistory: TransitionRecord[] = [];
  private reflectionToken = 0;
  private voiceToken = 0;
  private voiceStarting = false;
  private targetRetryPage: string | null = null;
  private pendingConnectionImage: string | null = null;
  private connectionEvidenceMisses = 0;
  private forcedChecks = 0;
  private lastGuideKey: string | null = null;
  private interactionTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingInteraction: {
    sourceId: string;
    originPage: string;
    expectedPage: string;
    reportedPage: string | null;
    reportedAt: number | null;
    clickedAt: number;
    checks: number;
  } | null = null;
  private lastClickAcknowledgedAt = 0;
  private sandboxPage: string | null = null;
  private pageConfirm: { page: string; attempts: number } | null = null;
  private navigationMark: { page: string; reportedAt: number; guideAt: number | null; audioAt: number | null } | null = null;
  private product: HTMLElement | null = null;

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
      sharedSurfaceLabel: this.sharedSurfaceLabel,
      hearing: this.hearing,
      ended: this.ended,
      rollout: this.rollout,
    };
  }

  start(): void {
    this.ended = false;
    this.acceptingHostEvents = true;
    this.metrics = createMetrics();
    this.apply({ type: "SESSION_STARTED", at: Date.now() });
    this.warmGuideSpeech();
  }

  async shareScreen(canvas: HTMLCanvasElement, product: HTMLElement): Promise<void> {
    const shareToken = ++this.shareToken;
    this.canvas = canvas;
    this.product = product;
    this.latestJpeg = null;
    const stream = await navigator.mediaDevices.getDisplayMedia(entireScreenCaptureOptions()).catch((error: unknown) => {
      throw screenShareError(error);
    });
    if (shareToken !== this.shareToken || this.ended) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }
    const track = stream.getVideoTracks()[0];
    if (!track) {
      stream.getTracks().forEach((item) => item.stop());
      throw new Error("Chrome did not return a video track.");
    }
    if (track.getSettings().displaySurface === "browser") {
      stream.getTracks().forEach((item) => item.stop());
      throw new Error("Choose Entire Screen in the share dialog.");
    }
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.srcObject = stream;
    try {
      await video.play();
    } catch (error) {
      stream.getTracks().forEach((item) => item.stop());
      video.srcObject = null;
      throw screenShareError(error);
    }
    if (shareToken !== this.shareToken || this.ended) {
      stream.getTracks().forEach((item) => item.stop());
      video.srcObject = null;
      return;
    }
    this.screenStream?.getTracks().forEach((item) => item.stop());
    if (this.video) this.video.srcObject = null;
    this.screenStream = stream;
    this.video = video;
    this.screenSharing = true;
    this.error = null;
    this.sharedSurfaceLabel = track.label || "Entire screen";
    track.onended = () => {
      if (this.screenStream !== stream) return;
      this.markScreenUnavailable();
    };
    this.previousFrame = null;
    this.perceptionToken += 1;
    this.reasoningToken += 1;
    this.reasoningController?.abort();
    this.speechToken += 1;
    this.playback.stop();
    this.activeDecisionId = null;
    this.reflectionToken += 1;
    this.pendingTransition = null;
    this.currentScreenImage = null;
    this.pendingConnectionImage = null;
    this.connectionEvidenceMisses = 0;
    this.targetRetryPage = null;
    this.pendingInteraction = null;
    this.forcedChecks = 0;
    this.stabilizer?.cancel();
    this.stabilizer = new Stabilizer(STABLE_WINDOW_MS, () => {
      void this.perceiveStableFrame();
    });
    if (this.sampleTimer) clearInterval(this.sampleTimer);
    this.sampleTimer = setInterval(() => this.sampleFrame(), SCREEN_SAMPLE_INTERVAL_MS);
    if (!this.microphone && !this.voiceStarting && this.log.world.agent.status !== "idle") void this.startVoice();
    this.scheduleForcedCheck();
    this.publish(this.snapshot());
    if (this.pageConfirm && !this.interactionTimer) {
      this.interactionTimer = setTimeout(() => {
        this.interactionTimer = null;
        void this.perceiveStableFrame();
      }, 200);
    }
    if (this.log.world.agent.activeGuide?.kind === "action") this.issueGuide(true);
  }

  stop(): void {
    this.ended = true;
    this.acceptingHostEvents = false;
    this.shareToken += 1;
    this.reasoningToken += 1;
    this.perceptionToken += 1;
    this.reflectionToken += 1;
    this.voiceToken += 1;
    this.pendingTransition = null;
    this.currentScreenImage = null;
    this.pendingConnectionImage = null;
    this.connectionEvidenceMisses = 0;
    this.targetRetryPage = null;
    this.pendingInteraction = null;
    this.pageConfirm = null;
    this.navigationMark = null;
    this.product = null;
    this.sandboxPage = null;
    this.lastGuideKey = null;
    this.reasoningController?.abort();
    this.reasoningController = null;
    if (this.sampleTimer) clearInterval(this.sampleTimer);
    if (this.forceTimer) clearTimeout(this.forceTimer);
    if (this.interactionTimer) clearTimeout(this.interactionTimer);
    this.stabilizer?.cancel();
    this.speechToken += 1;
    this.playback.stop();
    this.activeDecisionId = null;
    this.pauseVoice();
    const screenStream = this.screenStream;
    this.screenStream = null;
    screenStream?.getTracks().forEach((track) => track.stop());
    if (this.video) {
      this.video.srcObject = null;
      this.video.remove();
      this.video = null;
    }
    this.latestJpeg = null;
    this.screenSharing = false;
    this.sharedSurfaceLabel = null;
    this.log = {
      ...this.log,
      world: {
        ...this.log.world,
        flags: { ...this.log.world.flags, screenAvailable: false },
        agent: { ...this.log.world.agent, status: "idle" },
      },
    };
    this.publish(this.snapshot());
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
    this.transitionHistory = [];
    this.publish(this.snapshot());
  }

  private apply(event: SessionEvent): void {
    const previousAttempts = this.log.world.workflow.recoveryAttempts;
    const previousSemantic = this.log.world.screen.semanticVersion;
    const previousStep = this.log.world.workflow.currentStep;
    this.log = dispatch(this.log, event);
    if (this.log.world.workflow.currentStep !== previousStep) {
      this.transitionHistory = [];
      this.pendingTransition = null;
    }
    if (event.type === "FRAME_SAMPLED" && event.changeRatio < PIXEL_CHANGE_THRESHOLD) {
      this.metrics.ignoredFrameChanges += 1;
    }
    if (event.type === "SCREEN_STATE_UPDATED" && event.semanticVersion > previousSemantic) {
      this.metrics.semanticScreenChanges += 1;
    }
    if (event.type === "DECISION_REJECTED_STALE") this.metrics.staleDecisionsRejected += 1;
    if (event.type === "WORKFLOW_DEVIATION") this.metrics.workflowDeviations += 1;
    if (event.type === "TRANSITION_REFLECTED") {
      this.metrics.reflectionCalls += 1;
      if (event.reflection.status === "mismatch") this.metrics.reflectionMismatches += 1;
      if (event.reflection.status === "unavailable") this.metrics.reflectionFallbacks += 1;
    }
    if ((event.type === "WORKFLOW_STEP_VERIFIED" || event.type === "WORKFLOW_PROGRESS_RECONCILED" || event.type === "WORKFLOW_ON_PATH") && previousAttempts > 0) {
      this.metrics.successfulRecoveries += 1;
    }
    if (event.type === "AGENT_INTERRUPTED") this.metrics.interruptions += 1;
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
          sharedSurfaceLabel: this.sharedSurfaceLabel,
          hearing: this.hearing,
          error: this.error,
          metrics: this.metrics,
          recentTurns: this.recentTurns,
        },
        null,
        2,
      ),
      screenshot,
    });
    if (this.trace.length > 2_500) this.trace.shift();
  }

  exportTrace(includeScreenshots = false): void {
    const entries = this.trace.map((entry) => ({ ...entry, screenshot: includeScreenshots ? entry.screenshot : null }));
    const html = renderTraceHtml(this.log.world.sessionId, entries);
    const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `session-${this.log.world.sessionId}.html`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  reportPage(page: string): void {
    this.onSandboxPage("host", page, Date.now());
  }

  reportClick(label: string): void {
    this.onSandboxInteraction("host", label, Date.now());
  }

  reportSurface(name: string, state: "opened" | "closed"): void {
    const safe = name.trim().replace(/\s+/g, " ").slice(0, 40);
    if (!safe || this.ended) return;
    this.apply({ type: "HOST_SURFACE", name: safe, state, at: Date.now() });
    if (state === "closed") return;
    this.pageConfirm = null;
    if (this.interactionTimer) clearTimeout(this.interactionTimer);
    this.interactionTimer = null;
    this.playback.prefetch([outsideWindowInstruction(safe)]);
    this.issueGuide(true);
  }

  startFromEvents(): void {
    this.start();
    void this.startVoice();
    const guide = this.log.world.agent.activeGuide;
    if (guide && guide.kind !== "wait") this.issueGuide(true);
  }

  onSandboxInteraction(sourceId: string, label: string, at: number): void {
    if (!this.acceptingHostEvents || this.ended || Date.now() - at > 5_000) return;
    const safeLabel = label.trim().slice(0, 80);
    if (!safeLabel) return;
    const page = canonicalizePage(this.log.world.screen.page);
    const currentGuide = this.log.world.agent.activeGuide;
    const guide = currentGuide?.kind === "action" ? currentGuide : actionForPage(page);
    const instructionBefore = currentGuide?.instruction ?? null;
    this.apply({ type: "SANDBOX_INTERACTION", label: safeLabel, at });
    const target = guide?.kind === "action" ? guide.target : "";
    this.pendingInteraction = guide?.kind === "action" && page && clickMatchesTarget(safeLabel, target)
      ? { sourceId, originPage: page, expectedPage: guide.expectedPage, reportedPage: null, reportedAt: null, clickedAt: at, checks: 0 }
      : null;
    this.perceptionToken += 1;
    this.reasoningToken += 1;
    this.reasoningController?.abort();
    this.stabilizer?.cancel();
    if (this.forceTimer) clearTimeout(this.forceTimer);
    if (this.interactionTimer) clearTimeout(this.interactionTimer);
    if (Date.now() - this.lastClickAcknowledgedAt > 800) {
      this.lastClickAcknowledgedAt = Date.now();
      this.interrupt();
    }
    const instruction = this.log.world.agent.activeGuide?.instruction ?? null;
    if (instruction && instruction !== instructionBefore) this.issueGuide();
  }

  onSandboxPage(sourceId: string, page: string, at: number): void {
    const canonical = canonicalizePage(page);
    const pending = this.pendingInteraction;
    if (pending && pending.sourceId === sourceId && at >= pending.clickedAt) {
      pending.reportedPage = canonical;
      pending.reportedAt = at;
    }
    const pageChanged = Boolean(canonical && canonical !== this.sandboxPage);
    if (canonical) this.sandboxPage = canonical;
    if (pageChanged && canonical) {
      this.pageConfirm = canonical !== "Loading" ? { page: canonical, attempts: 0 } : null;
      this.navigationMark = { page: canonical, reportedAt: at, guideAt: null, audioAt: null };
    }
    this.apply({ type: "SANDBOX_PAGE_REPORTED", page, at });
    if (canonical === "Loading") this.issueGuide();
    else if (canonical) this.adoptReportedPage(canonical, at);
    if (!this.screenSharing || this.ended || !pageChanged) return;
    this.perceptionToken += 1;
    this.stabilizer?.cancel();
    if (this.forceTimer) clearTimeout(this.forceTimer);
    if (this.interactionTimer) clearTimeout(this.interactionTimer);
    this.interactionTimer = setTimeout(() => {
      this.interactionTimer = null;
      void this.perceiveStableFrame();
    }, 200);
  }

  private retryPageConfirm(seenPage: string | null): void {
    const confirm = this.pageConfirm;
    if (!confirm || !this.screenSharing || this.ended) return;
    if (confirm.attempts >= 1) {
      this.pageConfirm = null;
      this.apply({
        type: "SCREEN_STATE_UPDATED",
        screen: {
          page: confirm.page,
          summary: seenPage ? `The shared screen still shows ${seenPage}.` : "The shared screen has not caught up.",
          semanticChange: false,
          changeType: "none",
          relevantElements: [],
          delta: seenPage ? `Still seeing ${seenPage}` : "Screen has not caught up",
        },
        semanticVersion: this.log.world.screen.semanticVersion,
        review: "screen_lag",
        at: Date.now(),
      });
      this.issueGuide(true);
      return;
    }
    confirm.attempts += 1;
    if (this.interactionTimer) clearTimeout(this.interactionTimer);
    this.interactionTimer = setTimeout(() => {
      this.interactionTimer = null;
      void this.perceiveStableFrame();
    }, 350);
  }

  private adoptReportedPage(page: string, at: number): void {
    const current = canonicalizePage(this.log.world.screen.page);
    if (current === page && this.log.world.agent.activeGuide?.kind === "action") return;
    const previousGuide = this.log.world.agent.activeGuide?.instruction;
    this.pendingInteraction = null;
    this.apply({
      type: "SCREEN_STATE_UPDATED",
      screen: {
        page,
        summary: `${page} is visible`,
        semanticChange: true,
        changeType: "navigation",
        relevantElements: [],
        delta: `Navigated to ${page}`,
      },
      semanticVersion: this.log.world.screen.semanticVersion + 1,
      review: page === "GitHub Connected" ? "confirmed_connection" : "normal",
      at,
    });
    this.finishScreenUpdate(true, previousGuide !== this.log.world.agent.activeGuide?.instruction);
  }

  private sampleFrame(): void {
    if (!this.video || !this.canvas || !this.screenSharing) return;
    const frame = sampleLuminance(this.video, this.canvas);
    if (!frame) return;
    this.frameVersion += 1;
    const ratio = this.previousFrame ? changeRatio(this.previousFrame, frame) : 1;
    this.previousFrame = frame;
    if (!this.latestJpeg || ratio >= PIXEL_CHANGE_THRESHOLD) {
      const jpeg = captureJpeg(this.video, this.product);
      if (jpeg) this.latestJpeg = jpeg;
    }
    this.apply({
      type: "FRAME_SAMPLED",
      frameVersion: this.frameVersion,
      changeRatio: ratio,
      at: Date.now(),
    });
    if (ratio < PIXEL_CHANGE_THRESHOLD || this.pageConfirm) return;
    this.apply({ type: "SCREEN_CHANGE_CANDIDATE", at: Date.now() });
    this.stabilizer?.bump();
  }

  private async perceiveStableFrame(): Promise<void> {
    if (!this.screenSharing || !this.video) return;
    const image = captureJpeg(this.video, this.product);
    if (!image) return;
    this.latestJpeg = image;
    const capturedAt = Date.now();
    const imageId = `frame-${this.frameVersion}-${capturedAt}`;
    this.shotForNextEvent = image;
    this.apply({ type: "SCREEN_STABILIZED", imageId, at: capturedAt });
    const token = ++this.perceptionToken;
    await this.perceive(image, imageId, token, true, capturedAt);
  }

  private async perceive(image: string, imageId: string, token: number, allowRetry: boolean, capturedAt = Date.now()): Promise<void> {
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
          expectedTarget: actionForPage(this.log.world.screen.page)?.target ?? null,
        }),
      });
      const payload: unknown = await response.json();
      if (token !== this.perceptionToken) return;
      if (!response.ok) throw new Error("Perception failed");
      const screen = ScreenStateSchema.parse((payload as { screen: unknown }).screen);
      const perceiveMs = Date.now() - started;
      this.metrics.perceptionLatenciesMs.push(perceiveMs);
      this.logLatency("perceive", perceiveMs);
      const page = canonicalizePage(screen.page);
      if (this.pageConfirm && page !== this.pageConfirm.page) {
        this.retryPageConfirm(page);
        return;
      }
      if (this.pageConfirm?.page === page) this.pageConfirm = null;
      if (this.sandboxPage && page && page !== this.sandboxPage) return;
      this.currentScreenImage = image;
      this.error = null;
      this.perceptionRetries.delete(imageId);
      const previousPage = this.log.world.screen.page;
      const previousGuide = this.log.world.agent.activeGuide?.instruction;
      const semanticChange = canonicalizePage(previousPage) === page
        ? false
        : resolveSemanticChange({
          reported: screen.semanticChange,
          previousPage,
          nextPage: screen.page,
        });
      this.previousPage = previousPage;
      const previousSemantic = this.log.world.screen.semanticVersion;
      const semanticVersion = nextSemanticVersion(previousSemantic, semanticChange);
      let review: ScreenReview = "normal";
      if (this.pendingInteraction && page && page !== this.pendingInteraction.originPage) {
        this.pendingInteraction = null;
      }
      if (page !== "GitHub Connected") {
        this.pendingConnectionImage = null;
        this.connectionEvidenceMisses = 0;
      }
      if (this.targetRetryPage !== page) this.targetRetryPage = null;
      if (page === "GitHub Connected") {
        if (this.log.world.goal.status === "completed") {
          review = "confirmed_connection";
        } else if (this.pendingConnectionImage && this.pendingConnectionImage !== imageId) {
          review = connectedEvidence(screen.summary, screen.relevantElements) ? "confirmed_connection" : "missing_connection";
          this.pendingConnectionImage = null;
        } else if (!connectedEvidence(screen.summary, screen.relevantElements)) {
          this.connectionEvidenceMisses += 1;
          review = this.connectionEvidenceMisses >= 2 ? "missing_connection" : "checking_connection";
        } else {
          review = "checking_connection";
          this.connectionEvidenceMisses = 0;
          this.pendingConnectionImage = imageId;
        }
      } else if (this.pendingInteraction && page === this.pendingInteraction.originPage) {
        const reportedAt = this.pendingInteraction.reportedAt;
        const frameFollowsPage = reportedAt != null && capturedAt >= reportedAt + 250;
        if (!frameFollowsPage) {
          review = "checking_transition";
        } else {
          this.pendingInteraction.checks += 1;
          review = this.pendingInteraction.checks >= 2
            ? this.pendingInteraction.reportedPage === this.pendingInteraction.expectedPage
              ? "stalled_shared_surface"
              : "stalled_transition"
            : "checking_transition";
        }
      } else if (page && actionForPage(page) && !targetVisible(page, screen.relevantElements)) {
        if (this.targetRetryPage === page) {
          review = "missing_target";
        } else {
          review = "checking_target";
          this.targetRetryPage = page;
        }
      } else {
        this.targetRetryPage = null;
      }
      if (this.sandboxPage && page === this.sandboxPage && page !== "GitHub Connected") review = "normal";
      if (canonicalizePage(previousPage) !== page) this.forcedChecks = 0;
      this.apply({
        type: "SCREEN_STATE_UPDATED",
        screen: { ...screen, semanticChange },
        semanticVersion,
        review,
        at: Date.now(),
      });
      void this.afterScreenUpdate(
        semanticVersion > previousSemantic,
        image,
        previousGuide !== this.log.world.agent.activeGuide?.instruction,
      );
      this.scheduleForcedCheck(
        review === "checking_connection" || review === "checking_target" || review === "checking_transition"
          ? 700 : FORCED_CHECK_INTERVAL_MS,
      );
    } catch {
      if (token !== this.perceptionToken) return;
      const attempts = this.perceptionRetries.get(imageId) ?? 0;
      if (allowRetry && attempts < 1) {
        this.perceptionRetries.set(imageId, attempts + 1);
        await this.perceive(image, imageId, token, false, capturedAt);
        return;
      }
      this.pendingConnectionImage = null;
      this.connectionEvidenceMisses = 0;
      this.targetRetryPage = null;
      this.perceptionRetries.delete(imageId);
      this.pendingTransition = null;
      this.currentScreenImage = null;
      this.error = "I couldn't verify the current screen.";
      this.apply({ type: "SCREEN_READ_FAILED", at: Date.now() });
      this.issueGuide(true);
      this.scheduleForcedCheck();
    }
  }

  private afterScreenUpdate(semanticChanged: boolean, afterImage: string, guideChanged: boolean): void {
    const world = this.log.world;
    const pending = this.pendingTransition;
    const reflectionToken = semanticChanged ? ++this.reflectionToken : this.reflectionToken;
    const expectedPage = canonicalizePage(pending?.specification.expectedPage);
    const observedPage = canonicalizePage(this.sandboxPage ?? world.screen.page);
    if (pending && expectedPage && expectedPage === observedPage) {
      this.pendingTransition = null;
    }
    const shouldReflect = Boolean(
      pending && expectedPage !== observedPage &&
      world.screen.perceptionStatus === "clear" &&
      world.screen.page !== "Loading" &&
      world.screen.semanticVersion > pending.basedOnScreenVersion,
    );
    if (shouldReflect && pending) {
      this.pendingTransition = null;
      const transition = buildReflectionInput(pending, {
        page: world.screen.page,
        summary: world.screen.summary,
      }, this.transitionHistory);
      void this.reflectTransition(transition, pending, afterImage, reflectionToken, world.screen.semanticVersion);
    }
    this.finishScreenUpdate(semanticChanged, guideChanged);
  }

  private async reflectTransition(
    transition: ReflectionInput,
    pending: PendingTransition,
    afterImage: string,
    token: number,
    screenVersion: number,
  ): Promise<void> {
    let assessment: ReflectionAssessment;
    let record: TransitionRecord | null = null;
    try {
      const reflection = await this.requestReflection(transition, pending.beforeImage, afterImage);
      assessment = {
        decisionId: pending.decisionId,
        subgoal: pending.specification.subgoal,
        expectedPage: transition.expectedPage,
        observedPage: transition.after.page,
        status: reflection.consistent ? "consistent" : "mismatch",
        result: reflection,
      };
      record = {
        subgoal: transition.subgoal,
        action: transition.action,
        before: transition.before,
        after: transition.after,
        expectedPage: transition.expectedPage,
        consistent: reflection.consistent,
      };
    } catch {
      assessment = {
        decisionId: pending.decisionId,
        subgoal: pending.specification.subgoal,
        expectedPage: transition.expectedPage,
        observedPage: transition.after.page,
        status: "unavailable",
        result: null,
      };
    }
    if (token !== this.reflectionToken || this.log.world.screen.semanticVersion !== screenVersion || this.ended) return;
    if (record && this.log.world.workflow.currentStep === pending.specification.subgoal) {
      this.transitionHistory = [...this.transitionHistory, record].slice(-5);
    }
    this.apply({ type: "TRANSITION_REFLECTED", reflection: assessment, at: Date.now() });
  }

  private async requestReflection(transition: ReflectionInput, beforeImage: string, afterImage: string) {
    const response = await fetch("/api/openai/reflect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transition, beforeImage, afterImage }),
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) throw new Error("Reflection failed");
    const payload: unknown = await response.json();
    return ReflectionResultSchema.parse((payload as { reflection: unknown }).reflection);
  }

  private finishScreenUpdate(semanticChanged: boolean, guideChanged: boolean): void {
    const world = this.log.world;
    const result = observeProgress({
      currentStep: world.workflow.currentStep,
      completedSteps: world.workflow.completedSteps,
      skippedSteps: world.workflow.skippedSteps,
      observedPage: world.screen.page,
      perceptionStatus: world.screen.perceptionStatus,
      review: world.screen.review,
    });
    if (result.outcome === "advance" || result.outcome === "revisit") {
      this.discrepancy = undefined;
      this.apply({
        type: "WORKFLOW_PROGRESS_RECONCILED",
        observedStep: result.observedStep,
        skippedSteps: result.outcome === "advance" ? result.skippedSteps : [],
        at: Date.now(),
      });
    } else if (result.outcome === "off_path" && semanticChanged) {
      const expected = world.workflow.expectedNextState ?? "GitHub setup";
      const observed = world.screen.page ?? "unknown";
      this.discrepancy = { expected, observed };
      this.apply({
        type: "WORKFLOW_DEVIATION",
        expected,
        observed,
        at: Date.now(),
      });
    } else if ((result.outcome === "backtrack" || result.outcome === "pending") && world.flags.conflictingEvidence &&
      this.log.world.agent.activeGuide?.kind === "action") {
      this.discrepancy = undefined;
      this.apply({ type: "WORKFLOW_ON_PATH", at: Date.now() });
    } else if (result.outcome !== "off_path") {
      this.discrepancy = undefined;
    }
    const shouldGuide = semanticChanged || guideChanged || result.outcome === "advance" || result.outcome === "revisit" ||
      world.screen.review !== "normal";
    if (shouldGuide && this.log.world.agent.status !== "idle") {
      if (semanticChanged) this.interrupt();
      if (this.log.world.conversation.activeQuestion) void this.reason("screen");
      else this.issueGuide();
    }
  }

  private issueGuide(force = false): void {
    const world = this.log.world;
    const guide = world.agent.activeGuide;
    if (!guide || world.agent.status === "idle" || this.ended) return;
    this.markGuideShown();
    const key = `${world.screen.page ?? "unknown"}:${guide.kind}:${guide.instruction}`;
    if (!force && key === this.lastGuideKey) return;
    this.lastGuideKey = key;
    this.reasoningToken += 1;
    this.reasoningController?.abort();
    this.interrupt();
    const decision = fallbackGuideDecision(guide, world.screen.semanticVersion);
    this.pendingTransition = createPendingTransition(decision, world, this.currentScreenImage);
    this.apply({ type: "DECISION_READY", decision, at: Date.now() });
    this.recentTurns = [...this.recentTurns, `Assistant: ${decision.response}`].slice(-4);
    if (decision.type !== "wait" && !isClickNotice(decision.response)) {
      this.warmGuideSpeech();
      void this.speak(decision.id, decision.response, decision.basedOnScreenVersion);
    }
  }

  private warmGuideSpeech(): void {
    const guide = this.log.world.agent.activeGuide;
    if (!guide || guide.kind === "wait") return;
    const lines = [guide.instruction];
    if (guide.kind === "action") {
      const next = actionForPage(guide.expectedPage);
      if (next && next.instruction !== guide.instruction) lines.push(next.instruction);
    }
    this.playback.prefetch(lines);
  }

  private scheduleForcedCheck(delay = FORCED_CHECK_INTERVAL_MS): void {
    if (this.forceTimer) clearTimeout(this.forceTimer);
    if (!this.screenSharing || this.ended || this.forcedChecks >= MAX_FORCED_CHECKS) return;
    const guide = this.log.world.agent.activeGuide;
    if (guide?.kind !== "action" && guide?.kind !== "wait" && guide?.kind !== "clarify") return;
    this.forceTimer = setTimeout(() => {
      this.forceTimer = null;
      if (!this.screenSharing || this.ended) return;
      this.forcedChecks += 1;
      void this.perceiveStableFrame();
    }, delay);
  }

  private async reason(trigger: string): Promise<void> {
    if (!this.log.world.conversation.activeQuestion && this.log.world.agent.activeGuide) {
      this.issueGuide(trigger === "speech" || trigger === "unavailable");
      return;
    }
    if (!this.screenSharing && trigger === "screen") return;
    const token = ++this.reasoningToken;
    this.reasoningController?.abort();
    const controller = new AbortController();
    this.reasoningController = controller;
    const world = this.log.world;
    const reasoningStartedAt = Date.now();
    this.apply({
      type: "REASONING_STARTED",
      basedOnScreenVersion: world.screen.semanticVersion,
      at: Date.now(),
    });
    const context = buildReasoningContext(world, this.recentTurns, this.discrepancy, this.previousPage);
    const signals = {
      perceptionStatus: world.screen.perceptionStatus,
      conflictingEvidence: world.flags.conflictingEvidence,
      recoveryAttempts: world.workflow.recoveryAttempts,
      userChangedGoal: detectGoalChange(world.conversation.latestUserUtterance),
    };
    try {
      const result = await requestDecision({
        context,
        signals,
        signal: controller.signal,
      });
      if (token !== this.reasoningToken) return;
      this.metrics.reasoningLatenciesMs.push(Date.now() - reasoningStartedAt);
      if (result.model === "deep") this.metrics.deepReasonerCalls += 1;
      else this.metrics.fastReasonerCalls += 1;
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
      const decision = guidedDecision(result.decision, world.agent.activeGuide, world.conversation.activeQuestion);
      const pending = !world.conversation.activeQuestion && this.log.world.screen.perceptionStatus === "clear"
        ? createPendingTransition(decision, this.log.world, this.currentScreenImage)
        : null;
      if (pending) this.pendingTransition = pending;
      this.apply({ type: "DECISION_READY", decision, at: Date.now() });
      this.recentTurns = [...this.recentTurns, `Assistant: ${decision.response}`].slice(-4);
      if (decision.type === "wait" || !decision.response.trim()) return;
      await this.speak(decision.id, decision.response, decision.basedOnScreenVersion);
    } catch {
      if (token !== this.reasoningToken) return;
      const guide = this.log.world.agent.activeGuide;
      if (guide) {
        const fallback = fallbackGuideDecision(guide, this.log.world.screen.semanticVersion);
        const decision = this.log.world.conversation.activeQuestion
          ? guidedDecision({ ...fallback, response: "I blanked on that. Ask me again in a second." }, guide, this.log.world.conversation.activeQuestion)
          : fallback;
        this.apply({ type: "DECISION_READY", decision, at: Date.now() });
        if (decision.type !== "wait" && !isClickNotice(decision.response)) {
          await this.speak(decision.id, decision.response, decision.basedOnScreenVersion);
        }
        return;
      }
      this.error = FALLBACK_SPEECH;
      this.recentTurns = [...this.recentTurns, `Assistant: ${FALLBACK_SPEECH}`].slice(-4);
      this.publish(this.snapshot());
      await this.speak(null, FALLBACK_SPEECH, this.log.world.screen.semanticVersion);
    } finally {
      if (this.reasoningController === controller) this.reasoningController = null;
    }
  }

  private markGuideShown(): void {
    const mark = this.navigationMark;
    if (!mark || mark.guideAt != null) return;
    mark.guideAt = Date.now();
    this.logLatency("page-to-guide", mark.guideAt - mark.reportedAt);
  }

  private markFirstAudio(): void {
    const mark = this.navigationMark;
    if (!mark || mark.audioAt != null) return;
    mark.audioAt = Date.now();
    this.logLatency("page-to-first-audio", mark.audioAt - mark.reportedAt);
  }

  private logLatency(name: string, elapsedMs: number): void {
    const mark = this.navigationMark;
    const page = mark?.page ?? this.sandboxPage ?? "unknown";
    const beside = mark
      ? ` since-page=${Date.now() - mark.reportedAt}ms guide=${mark.guideAt == null ? "pending" : `${mark.guideAt - mark.reportedAt}ms`} audio=${mark.audioAt == null ? "pending" : `${mark.audioAt - mark.reportedAt}ms`}`
      : "";
    console.info(`[latency] ${name} ${elapsedMs}ms page=${page}${beside}`);
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
    const speechToken = ++this.speechToken;
    this.playback.stop();
    this.activeDecisionId = decisionId;
    if (decisionId) {
      this.apply({ type: "AGENT_SPEECH_STARTED", decisionId, at: Date.now() });
    }
    try {
      const spoken = await this.playback.speak(text, () => this.markFirstAudio());
      if (!spoken || speechToken !== this.speechToken || basedOnScreenVersion !== this.log.world.screen.semanticVersion) return;
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
      if (speechToken !== this.speechToken) return;
      this.error = text;
      this.publish(this.snapshot());
    }
  }

  private interrupt(): void {
    if (this.log.world.agent.status !== "speaking" && !this.playback.playing) return;
    this.speechToken += 1;
    this.playback.stop();
    this.apply({
      type: "AGENT_INTERRUPTED",
      decisionId: this.activeDecisionId,
      at: Date.now(),
    });
    this.activeDecisionId = null;
  }

  private async startVoice(): Promise<void> {
    if (this.voiceStarting || this.microphone || this.ended) return;
    this.voiceStarting = true;
    const voiceToken = ++this.voiceToken;
    try {
      const transcription = new RealtimeTranscription({
        onPartial: (text, itemId) => {
          if (voiceToken !== this.voiceToken) return;
          this.apply({ type: "USER_TRANSCRIPT_PARTIAL", text, itemId, at: Date.now() });
        },
        onFinal: (text, itemId) => {
          if (voiceToken !== this.voiceToken) return;
          this.apply({ type: "USER_TRANSCRIPT_FINAL", text, itemId, at: Date.now() });
          this.recentTurns = [...this.recentTurns, `User: ${text}`].slice(-4);
          void this.reason("speech");
        },
        onError: (message) => {
          if (voiceToken !== this.voiceToken) return;
          this.error = message;
          this.publish(this.snapshot());
        },
      });
      this.transcription = transcription;
      const { openDenoisedMicrophone } = await import("@/lib/voice/noise-suppressor");
      const microphone = await openDenoisedMicrophone();
      if (voiceToken !== this.voiceToken || this.ended) {
        microphone.close();
        return;
      }
      this.microphone = microphone;
      this.audioContext = this.microphone.context;
      const connection = await transcription.connect(this.microphone.stream, {
        commit: () => undefined,
      });
      if (voiceToken !== this.voiceToken || this.ended) {
        transcription.stop();
        return;
      }
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
      if (voiceToken !== this.voiceToken) return;
      this.pauseVoice();
      this.error = error instanceof Error ? error.message : "Microphone connection failed";
      this.publish(this.snapshot());
    } finally {
      if (voiceToken === this.voiceToken) this.voiceStarting = false;
    }
  }

  private pauseVoice(): void {
    this.voiceToken += 1;
    this.voiceStarting = false;
    this.transcription?.stop();
    this.transcription = null;
    this.vad?.stop();
    this.vad = null;
    this.microphone?.close();
    this.microphone = null;
    this.audioContext = null;
    this.hearing = false;
    this.levelListener?.(0);
  }

  private markScreenUnavailable(): void {
    this.previousPage = this.log.world.screen.page ?? this.previousPage;
    this.screenSharing = false;
    this.sharedSurfaceLabel = null;
    this.screenStream = null;
    if (this.forceTimer) clearTimeout(this.forceTimer);
    this.perceptionToken += 1;
    this.reasoningToken += 1;
    this.reasoningController?.abort();
    this.speechToken += 1;
    this.playback.stop();
    this.activeDecisionId = null;
    this.reflectionToken += 1;
    this.pendingTransition = null;
    this.currentScreenImage = null;
    this.pendingConnectionImage = null;
    this.connectionEvidenceMisses = 0;
    this.targetRetryPage = null;
    this.pendingInteraction = null;
    if (this.sampleTimer) clearInterval(this.sampleTimer);
    if (this.interactionTimer) clearTimeout(this.interactionTimer);
    this.stabilizer?.cancel();
    this.apply({ type: "SCREEN_UNAVAILABLE", at: Date.now() });
    this.error = "Screen sharing stopped. Share the entire screen and I'll pick it back up.";
    this.pauseVoice();
    this.publish(this.snapshot());
    if (!this.ended && this.log.world.agent.status !== "idle") this.issueGuide(true);
  }
}

function screenShareError(error: unknown): Error {
  const message = error instanceof Error ? error.message : "";
  if (/could not start video source/i.test(message)) {
    return new Error("Choose Entire Screen in the share dialog. If it still fails, allow screen recording for this browser.");
  }
  if (error instanceof Error && error.name === "NotAllowedError") return new Error("Screen sharing was cancelled.");
  return error instanceof Error ? error : new Error("Screen sharing did not start.");
}

function isClickNotice(text: string): boolean {
  return /i saw the .+click/i.test(text);
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
    case "SANDBOX_INTERACTION":
      return event.label;
    case "SANDBOX_PAGE_REPORTED":
      return event.page;
    case "HOST_SURFACE":
      return `${event.state} ${event.name}`;
    case "REASONING_STARTED":
      return `v${event.basedOnScreenVersion}`;
    case "DECISION_READY":
      return `${event.decision.type}: ${event.decision.response}`;
    case "DECISION_REJECTED_STALE":
      return `${event.decisionId} current v${event.currentScreenVersion}`;
    case "WORKFLOW_STEP_VERIFIED":
      return event.stepId;
    case "WORKFLOW_PROGRESS_RECONCILED":
      return `${event.observedStep}, skipped ${event.skippedSteps.join(", ") || "none"}`;
    case "WORKFLOW_DEVIATION":
      return `expected ${event.expected}, observed ${event.observed}`;
    case "TRANSITION_REFLECTED":
      return `${event.reflection.status}: expected ${event.reflection.expectedPage}, observed ${event.reflection.observedPage ?? "unknown"}`;
    case "AGENT_SPEECH_STARTED":
    case "AGENT_INTERRUPTED":
      return event.decisionId ?? "";
    default:
      return "";
  }
}
