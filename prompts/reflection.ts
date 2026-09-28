import type { ReflectionInput } from "@/schemas/reflection";

export function buildReflectionPrompt(input: ReflectionInput): string {
  return `You check one screen transition in a voice-guided GUI workflow. The user was instructed to act; you do not know whether they followed it. Compare the BEFORE and AFTER images with the symbolic transition specification. Decide only whether the observed transition is consistent with the intended effect. Do not judge whether the intended effect was the right plan. Never infer success from an unclear image; explain any uncertainty in the alignment. Use concise, factual descriptions.

TRANSITION SPECIFICATION
Subgoal: ${input.subgoal}
Action intent: ${input.action}
Target: ${input.target ?? "unspecified"}
Precondition: ${input.precondition}
Postcondition: ${input.postcondition}
Before state: ${JSON.stringify(input.before)}
Observed after state: ${JSON.stringify(input.after)}

RECENT TRANSITIONS IN THIS SUBGOAL (oldest first, maximum five)
${JSON.stringify(input.history)}

Return consistent, beforeDescription, afterDescription, observedChange, and alignment. The first image is BEFORE; the second image is AFTER.`;
}
