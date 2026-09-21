/**
 * Currently a no-op. Per-suite fixtures own their own cleanup. This file exists
 * so each app's playwright.config can wire `globalTeardown` consistently and we
 * have a single place to add cross-suite cleanup later (e.g., purging webhook
 * event tables).
 */
export default async function globalTeardown(): Promise<void> {
  // intentionally empty
}
