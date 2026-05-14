/**
 * Wraps the global `fetch` with an AbortController deadline.
 *
 * @param url      Request URL
 * @param options  RequestInit — `signal` is merged with the timeout signal via
 *                 `AbortSignal.any` so that either side can cancel independently
 *                 (requires Node ≥ 20 / WHATWG `AbortSignal.any`).
 * @param timeoutMs  Wall-clock deadline in ms (default 10 000)
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 10_000,
): Promise<Response> {
  const controller = new AbortController();
  let timedOut = false;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  // Merge the timeout signal with any caller-supplied signal so that either
  // can abort the request independently.
  const callerSignal = options.signal ?? undefined;
  const signal = callerSignal
    ? AbortSignal.any([controller.signal, callerSignal as AbortSignal])
    : controller.signal;

  try {
    return await fetch(url, { ...options, signal });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError' && timedOut) {
      const hostname = (() => {
        try { return new URL(url).hostname; } catch { return url; }
      })();
      throw new Error(
        `fetchWithTimeout: request to ${hostname} timed out after ${timeoutMs}ms`,
      );
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}
