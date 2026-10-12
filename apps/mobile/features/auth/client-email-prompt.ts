/**
 * In-memory state for the one-time client email prompt. An auth continuation
 * (booking/redirect carried through login) suppresses the prompt so it never
 * steals that navigation. The "later" snooze lives in client-email-snooze.ts.
 */
let continuationDepth = 0;

/** Test seam: reset module state between cases. */
export function resetClientEmailPromptStateForTests(): void {
  continuationDepth = 0;
}

export function beginAuthContinuation(): void {
  continuationDepth += 1;
}

export function endAuthContinuation(): void {
  continuationDepth = Math.max(0, continuationDepth - 1);
}

export function isAuthContinuationActive(): boolean {
  return continuationDepth > 0;
}
