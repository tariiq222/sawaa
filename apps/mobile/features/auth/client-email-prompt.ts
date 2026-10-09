/**
 * In-memory, per-app-session state for the one-time client email prompt.
 * "Later" snoozes the prompt until the app restarts; nothing is persisted and
 * the server is never told. An auth continuation (booking/redirect carried
 * through login) suppresses the prompt so it never steals that navigation.
 */
let snoozedForSession = false;

export function snoozeClientEmailPromptForSession(): void {
  snoozedForSession = true;
}

export function isClientEmailPromptSnoozed(): boolean {
  return snoozedForSession;
}

/** Test seam: reset module state between cases. */
export function resetClientEmailPromptStateForTests(): void {
  snoozedForSession = false;
  continuationDepth = 0;
}

let continuationDepth = 0;

export function beginAuthContinuation(): void {
  continuationDepth += 1;
}

export function endAuthContinuation(): void {
  continuationDepth = Math.max(0, continuationDepth - 1);
}

export function isAuthContinuationActive(): boolean {
  return continuationDepth > 0;
}
