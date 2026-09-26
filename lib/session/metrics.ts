export type SessionMetrics = {
  startedAt: number;
  visionCalls: number;
  fastReasonerCalls: number;
  deepReasonerCalls: number;
  semanticScreenChanges: number;
  ignoredFrameChanges: number;
  staleDecisionsRejected: number;
  workflowDeviations: number;
  successfulRecoveries: number;
  interruptions: number;
  lookaheadRuns: number;
  lookaheadFallbacks: number;
  lookaheadBranches: number;
  lookaheadModelCalls: number;
  reasoningLatenciesMs: number[];
  perceptionLatenciesMs: number[];
  lookaheadLatenciesMs: number[];
};

export function createMetrics(startedAt = Date.now()): SessionMetrics {
  return {
    startedAt,
    visionCalls: 0,
    fastReasonerCalls: 0,
    deepReasonerCalls: 0,
    semanticScreenChanges: 0,
    ignoredFrameChanges: 0,
    staleDecisionsRejected: 0,
    workflowDeviations: 0,
    successfulRecoveries: 0,
    interruptions: 0,
    lookaheadRuns: 0,
    lookaheadFallbacks: 0,
    lookaheadBranches: 0,
    lookaheadModelCalls: 0,
    reasoningLatenciesMs: [],
    perceptionLatenciesMs: [],
    lookaheadLatenciesMs: [],
  };
}

export function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}
