/**
 * Ensures only one /auth/refresh call is in-flight at a time.
 * Multiple 401s queue and reuse the same refresh promise.
 */
let refreshPromise: Promise<string> | null = null

export function getRefreshMutex(): Promise<string> | null {
  return refreshPromise
}

export function setRefreshMutex(p: Promise<string>): void {
  refreshPromise = p
  // .finally rethrows the underlying rejection; without a trailing .catch the
  // returned promise becomes an unhandled-rejection in tests/strict runtimes.
  // Real awaiters of `p` still see the rejection — this only swallows the
  // bookkeeping promise we don't return.
  p.finally(() => {
    refreshPromise = null
  }).catch(() => {})
}
