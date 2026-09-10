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
  (timeoutId as NodeJS.Timeout).unref?.();

  // Merge the timeout signal with any caller-supplied signal so that either
  // can abort the request independently.
  const callerSignal = options.signal ?? undefined;
  const signal = callerSignal
    ? AbortSignal.any([controller.signal, callerSignal as AbortSignal])
    : controller.signal;

  const translateAbort = (err: unknown): unknown => {
    if (err instanceof Error && err.name === 'AbortError' && timedOut) {
      const hostname = (() => {
        try { return new URL(url).hostname; } catch { return url; }
      })();
      return new Error(
        `fetchWithTimeout: request to ${hostname} timed out after ${timeoutMs}ms`,
      );
    }
    return err;
  };

  try {
    const response = await fetch(url, { ...options, signal });
    const bodyMethods = ['arrayBuffer', 'blob', 'formData', 'json', 'text'] as const;
    let wrappedBodyConsumer = false;

    // Fetch resolves when headers arrive. Keep the same deadline alive until a
    // standard body consumer settles, while preserving the Response object and
    // every existing caller signature.
    for (const method of bodyMethods) {
      const consumer = response[method];
      if (typeof consumer !== 'function') continue;
      wrappedBodyConsumer = true;
      Object.defineProperty(response, method, {
        configurable: true,
        value: async (...args: unknown[]) => {
          try {
            return await (consumer as (...inner: unknown[]) => Promise<unknown>).apply(
              response,
              args,
            );
          } catch (err) {
            throw translateAbort(err);
          } finally {
            clearTimeout(timeoutId);
          }
        },
      });
    }

    // Lightweight Response-like test doubles and callers without a body have
    // nothing left to consume, so their deadline is complete at headers.
    if (!wrappedBodyConsumer) clearTimeout(timeoutId);
    return response;
  } catch (err) {
    clearTimeout(timeoutId);
    throw translateAbort(err);
  }
}
