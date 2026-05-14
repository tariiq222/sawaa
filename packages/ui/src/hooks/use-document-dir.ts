"use client"

import { useState, useEffect } from "react"

function readDir(): "ltr" | "rtl" {
  return (document.documentElement.dir as "ltr" | "rtl") || "ltr"
}

/**
 * Returns the current `dir` attribute on <html> and re-renders
 * whenever it changes (e.g. when the locale is toggled).
 *
 * Uses "ltr" as the initial/SSR value (the HTML spec default) to avoid
 * hydration mismatches. The real DOM value is synced in useEffect after
 * hydration completes.
 */
export function useDocumentDir(): "ltr" | "rtl" {
  // "ltr" matches the HTML spec default and avoids SSR/client mismatch.
  // The real value is synced in useEffect after hydration.
  const [dir, setDir] = useState<"ltr" | "rtl">("ltr")

  useEffect(() => {
    // Sync with the actual DOM value after hydration.
    setDir(readDir())

    const observer = new MutationObserver(() => setDir(readDir()))
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["dir"],
    })
    return () => observer.disconnect()
  }, [])

  return dir
}
