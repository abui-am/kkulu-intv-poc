export const PCM_SAMPLE_RATE = 24_000;

export function takeCompletePcm(pending: Uint8Array, chunk: Uint8Array): { samples: Int16Array; rest: Uint8Array } {
  const merged = new Uint8Array(pending.length + chunk.length);
  merged.set(pending, 0);
  merged.set(chunk, pending.length);
  const even = merged.length - (merged.length % 2);
  const samples = new Int16Array(even / 2);
  const view = new DataView(merged.buffer, merged.byteOffset, even);
  for (let index = 0; index < samples.length; index += 1) {
    samples[index] = view.getInt16(index * 2, true);
  }
  return { samples, rest: merged.subarray(even) };
}
