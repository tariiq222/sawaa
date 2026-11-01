"use client"

import { useCallback, useRef, useState } from "react"

/**
 * Re-entry guard for a whole multi-step submit flow (t12).
 *
 * A ref — not the mutation's `isPending` — blocks a second submission
 * synchronously, before React can re-render the disabled submit button, and
 * keeps the lock for the entire flow (save + upload + attach). The boolean
 * state drives the disabled/pending UI, and `end` releases the lock on every
 * exit path (success, mapped API failure and throw) so a failed attempt stays
 * retryable.
 *
 * The ref lives inside this hook so callers never read it during render.
 */
export function useSubmitLock() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const lock = useRef(false)
  const start = useCallback(() => {
    if (lock.current) return false
    lock.current = true
    setIsSubmitting(true)
    return true
  }, [])
  const end = useCallback(() => {
    lock.current = false
    setIsSubmitting(false)
  }, [])
  const isLocked = useCallback(() => lock.current, [])
  return { isSubmitting, start, end, isLocked }
}
