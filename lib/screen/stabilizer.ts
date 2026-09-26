export class Stabilizer {
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly windowMs: number,
    private readonly onStable: () => void,
  ) {}

  bump(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      this.onStable();
    }, this.windowMs);
  }

  cancel(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
}
