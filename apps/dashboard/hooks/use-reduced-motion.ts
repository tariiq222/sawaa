"use client"

import { useSyncExternalStore } from "react"

const QUERY = "(prefers-reduced-motion: reduce)"

/**
 * Subscribe to the matchMedia change events for prefers-reduced-motion.
 * Returns null on the server so React can render synchronously without
 * waiting for a hydration effect.
 */
function subscribe(callback: () => void): () => void {
  if (typeof window === "undefined" || !window.matchMedia) {
    return () => {}
  }
  const mq = window.matchMedia(QUERY)
  mq.addEventListener("change", callback)
  return () => mq.removeEventListener("change", callback)
}

function getSnapshot(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false
  return window.matchMedia(QUERY).matches
}

function getServerSnapshot(): boolean {
  return false
}

/**
 * Returns true if the user has `prefers-reduced-motion: reduce` set.
 *
 * On the server and during the first render the default is `false`
 * (animations enabled) to match the visual baseline. The actual OS
 * preference is read on mount and subscribed via useSyncExternalStore
 * so the UI updates reactively when the preference changes mid-session.
 *
 * Usage:
 *   const reduce = useReducedMotion()
 *   <div className={reduce ? "" : "animate-in fade-in duration-300"} />
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}