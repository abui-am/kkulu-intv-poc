export async function acquireController(): Promise<(() => void) | null> {
  if (!navigator.locks) return null;
  let resolveResult: (release: (() => void) | null) => void = () => undefined;
  const result = new Promise<(() => void) | null>((resolve) => { resolveResult = resolve; });
  void navigator.locks.request("kulu-agent-voice-controller", { ifAvailable: true }, async (lock) => {
    if (!lock) {
      resolveResult(null);
      return;
    }
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => { release = resolve; });
    resolveResult(release);
    await held;
  }).catch(() => resolveResult(null));
  return result;
}
