import type { ScreenState } from "@/schemas/screen-state";
import { canonicalizePage } from "@/lib/workflow/pages";

export function derivePerceptionStatus(screen: ScreenState): "clear" | "ambiguous" {
  if (!screen.page.trim() || !screen.summary.trim()) return "ambiguous";
  if (screen.ambiguity?.ambiguous) return "ambiguous";
  if (!canonicalizePage(screen.page)) return "ambiguous";
  return "clear";
}

export function resolveSemanticChange(input: {
  reported: boolean;
  previousPage: string | null;
  nextPage: string;
}): boolean {
  if (input.previousPage == null && input.nextPage.trim().length > 0) return true;
  const previous = canonicalizePage(input.previousPage);
  const next = canonicalizePage(input.nextPage);
  if (previous && next && previous !== next) return true;
  return input.reported;
}

export function nextSemanticVersion(current: number, semanticChange: boolean): number {
  return semanticChange ? current + 1 : current;
}
