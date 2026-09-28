import { PCM_SAMPLE_RATE, takeCompletePcm } from "@/lib/voice/pcm";

const START_SECONDS = 0.04;
const WARM_CONCURRENCY = 4;
const CLIP_VERSION = "coral-v2";

type SpeechEntry = {
  chunks: Int16Array[];
  done: boolean;
  failed: boolean;
  notify: Set<() => void>;
};

export class SpeechPlayback {
  private context: AudioContext | null = null;
  private sources: AudioBufferSourceNode[] = [];
  private playAbort: AbortController | null = null;
  private generation = 0;
  private active = false;
  private entries = new Map<string, SpeechEntry>();
  private warmSlots = 0;

  get playing(): boolean {
    return this.active;
  }

  prefetch(texts: string[]): void {
    const pending = texts.filter((text) => text.length > 0 && !this.entries.has(this.clipKey(text)));
    const kick = () => {
      while (this.warmSlots < WARM_CONCURRENCY && pending.length > 0) {
        const text = pending.shift();
        if (!text || this.entries.has(this.clipKey(text))) continue;
        this.warmSlots += 1;
        const entry = this.startDownload(text);
        const done = () => {
          if (!entry.done && !entry.failed) return;
          entry.notify.delete(done);
          this.warmSlots -= 1;
          kick();
        };
        entry.notify.add(done);
        done();
      }
    };
    kick();
  }

  stop(): void {
    this.generation += 1;
    this.playAbort?.abort();
    this.playAbort = null;
    this.stopSources();
    this.active = false;
  }

  async speak(text: string, onFirstAudio?: () => void): Promise<boolean> {
    this.stop();
    const generation = this.generation;
    const abort = new AbortController();
    this.playAbort = abort;
    this.active = true;
    try {
      const entry = this.startDownload(text);
      await this.playEntry(entry, generation, abort.signal, onFirstAudio);
      return generation === this.generation;
    } catch (error) {
      if (generation !== this.generation || isAbort(error)) return false;
      throw error;
    } finally {
      if (generation === this.generation) this.active = false;
    }
  }

  private clipKey(text: string): string {
    return `${CLIP_VERSION}:${text}`;
  }

  private startDownload(text: string): SpeechEntry {
    const key = this.clipKey(text);
    const existing = this.entries.get(key);
    if (existing) return existing;
    const entry: SpeechEntry = { chunks: [], done: false, failed: false, notify: new Set() };
    this.entries.set(key, entry);
    void this.fill(text, entry);
    return entry;
  }

  private async fill(text: string, entry: SpeechEntry): Promise<void> {
    try {
      const response = await fetch("/api/openai/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!response.ok || !response.body) throw new Error("TTS failed");
      const reader = response.body.getReader();
      let rest = new Uint8Array();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value) continue;
        const taken = takeCompletePcm(rest, value);
        rest = new Uint8Array(taken.rest);
        if (taken.samples.length === 0) continue;
        entry.chunks.push(taken.samples);
        this.publish(entry);
      }
      entry.done = true;
    } catch {
      entry.failed = true;
    } finally {
      this.publish(entry);
      if (entry.failed && this.entries.get(this.clipKey(text)) === entry) this.entries.delete(this.clipKey(text));
    }
  }

  private publish(entry: SpeechEntry): void {
    for (const listener of [...entry.notify]) listener();
  }

  private async playEntry(entry: SpeechEntry, generation: number, signal: AbortSignal, onFirstAudio?: () => void): Promise<void> {
    const context = await this.prepareContext();
    if (generation !== this.generation) return;
    let chunkIndex = 0;
    let nextTime = context.currentTime;
    let buffered: Int16Array[] = [];
    let bufferedSamples = 0;
    const startSamples = Math.floor(PCM_SAMPLE_RATE * START_SECONDS);
    let started = false;

    const flush = (force: boolean) => {
      if (generation !== this.generation || this.context !== context) return;
      if (!started) {
        if (!force && bufferedSamples < startSamples) return;
        if (bufferedSamples === 0) return;
        started = true;
        onFirstAudio?.();
        nextTime = context.currentTime;
      }
      for (const samples of buffered) nextTime = this.schedule(context, samples, nextTime);
      buffered = [];
      bufferedSamples = 0;
    };

    const takeNew = (force: boolean) => {
      while (chunkIndex < entry.chunks.length) {
        const samples = entry.chunks[chunkIndex];
        chunkIndex += 1;
        buffered.push(samples);
        bufferedSamples += samples.length;
      }
      flush(force);
    };

    await new Promise<void>((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout> | null = null;
      let settled = false;
      const settle = (error?: unknown) => {
        if (settled) return;
        settled = true;
        entry.notify.delete(onUpdate);
        if (timer) clearTimeout(timer);
        if (error) reject(error);
        else resolve();
      };
      const onUpdate = () => {
        if (settled) return;
        if (generation !== this.generation) {
          settle();
          return;
        }
        if (entry.failed) {
          settle(new Error("TTS failed"));
          return;
        }
        takeNew(entry.done);
        if (!entry.done || timer) return;
        const remaining = Math.max(0, nextTime - context.currentTime);
        timer = setTimeout(() => settle(), remaining * 1000 + 40);
      };
      const onAbort = () => settle(new DOMException("Aborted", "AbortError"));
      if (signal.aborted) {
        onAbort();
        return;
      }
      entry.notify.add(onUpdate);
      signal.addEventListener("abort", onAbort, { once: true });
      onUpdate();
    });
  }

  private async prepareContext(): Promise<AudioContext> {
    if (!this.context || this.context.state === "closed") this.context = new AudioContext();
    if (this.context.state === "suspended") await this.context.resume();
    return this.context;
  }

  private stopSources(): void {
    for (const source of this.sources) {
      try {
        source.stop();
      } catch {
        /* already finished */
      }
    }
    this.sources = [];
  }

  private schedule(context: AudioContext, samples: Int16Array, nextTime: number): number {
    if (samples.length === 0) return nextTime;
    const buffer = context.createBuffer(1, samples.length, PCM_SAMPLE_RATE);
    const channel = buffer.getChannelData(0);
    for (let index = 0; index < samples.length; index += 1) {
      channel[index] = samples[index] / 32_768;
    }
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    const startAt = Math.max(nextTime, context.currentTime);
    source.start(startAt);
    this.sources.push(source);
    source.onended = () => {
      this.sources = this.sources.filter((item) => item !== source);
    };
    return startAt + buffer.duration;
  }
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}
