export class SpeechPlayback {
  private audio: HTMLAudioElement | null = null;
  private url: string | null = null;

  get playing(): boolean {
    return Boolean(this.audio && !this.audio.paused && !this.audio.ended);
  }

  stop(): void {
    if (this.audio) {
      this.audio.onended = null;
      this.audio.pause();
      this.audio.src = "";
      this.audio = null;
    }
    if (this.url) {
      URL.revokeObjectURL(this.url);
      this.url = null;
    }
  }

  async play(blob: Blob): Promise<void> {
    this.stop();
    this.url = URL.createObjectURL(blob);
    const audio = new Audio(this.url);
    this.audio = audio;
    await new Promise<void>((resolve, reject) => {
      audio.onended = () => resolve();
      audio.onerror = () => reject(new Error("Audio playback failed"));
      void audio.play().catch(reject);
    });
  }
}
