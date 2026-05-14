/**
 * Minimal browser event bus for route-progress bar coordination.
 *
 * Usage:
 *   emit  → call `emitNavStart(href)` before any programmatic router.push()
 *   listen → RouteProgress subscribes with `onNavStart(cb)`
 *
 * Why not use a React context? The progress bar and the callers can be deeply
 * nested in different trees; a global CustomEvent is simpler and zero-cost.
 */

const NAV_START = "deqah:nav:start"

export function emitNavStart(href: string): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent(NAV_START, { detail: { href } }))
}

export function onNavStart(
  cb: (href: string) => void
): () => void {
  if (typeof window === "undefined") return () => {}
  const handler = (e: Event) => cb((e as CustomEvent<{ href: string }>).detail.href)
  window.addEventListener(NAV_START, handler)
  return () => window.removeEventListener(NAV_START, handler)
}
