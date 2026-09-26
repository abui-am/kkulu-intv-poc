export const VAD_START_THRESHOLD = 0.045;
export const VAD_START_HOLD_MS = 80;
export const VAD_END_SILENCE_MS = 600;

export type VadCallbacks = {
  onSpeechStart: () => void;
  onSpeechEnd: () => void;
  onLevel?: (rms: number) => void;
};

export class EnergyVad {
  private speaking = false;
  private aboveSince: number | null = null;
  private belowSince: number | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly analyser: AnalyserNode,
    private readonly callbacks: VadCallbacks,
  ) {}

  start(): void {
    const samples = new Uint8Array(this.analyser.fftSize);
    this.timer = setInterval(() => {
      this.analyser.getByteTimeDomainData(samples);
      let sum = 0;
      for (const value of samples) {
        const normalized = (value - 128) / 128;
        sum += normalized * normalized;
      }
      this.observe(Math.sqrt(sum / samples.length), performance.now());
    }, 50);
  }

  observe(rms: number, now: number): void {
    this.callbacks.onLevel?.(rms);
    if (rms >= VAD_START_THRESHOLD) {
      this.belowSince = null;
      this.aboveSince ??= now;
      if (!this.speaking && now - this.aboveSince >= VAD_START_HOLD_MS) {
        this.speaking = true;
        this.callbacks.onSpeechStart();
      }
      return;
    }
    this.aboveSince = null;
    if (!this.speaking) return;
    this.belowSince ??= now;
    if (now - this.belowSince >= VAD_END_SILENCE_MS) {
      this.speaking = false;
      this.belowSince = null;
      this.callbacks.onSpeechEnd();
    }
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}
