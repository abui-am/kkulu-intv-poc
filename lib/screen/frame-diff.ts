import { LUMINANCE_DELTA } from "@/lib/screen/config";

export function changeRatio(
  previous: Uint8Array,
  next: Uint8Array,
  delta = LUMINANCE_DELTA,
): number {
  const total = Math.min(previous.length, next.length);
  if (total === 0) return 0;
  let changed = 0;
  for (let index = 0; index < total; index += 1) {
    if (Math.abs(previous[index] - next[index]) > delta) changed += 1;
  }
  return changed / total;
}
