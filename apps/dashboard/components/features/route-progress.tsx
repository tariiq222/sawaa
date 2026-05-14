"use client"

import { useEffect, useRef, useState, startTransition } from "react"
import { usePathname } from "next/navigation"
import { onNavStart } from "@/lib/navigation-events"

type ProgressState = "idle" | "loading" | "done"

export function RouteProgress() {
  const pathname = usePathname()
  const [state, setState] = useState<ProgressState>("idle")
  const [width, setWidth] = useState(0)
  const prevPathname = useRef(pathname)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  const clear = () => timers.current.forEach(clearTimeout)

  const startProgress = () => {
    clear()
    setState("loading")
    setWidth(15)
    timers.current = [
      setTimeout(() => setWidth(40), 150),
      setTimeout(() => setWidth(65), 500),
      setTimeout(() => setWidth(82), 1200),
    ]
  }

  /* ── source 1: <Link> / <a> clicks ── */
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      const anchor = target.closest("a[href]") as HTMLAnchorElement | null
      if (!anchor) return
      try {
        const url = new URL(anchor.href, window.location.href)
        const isSameOrigin = url.origin === window.location.origin
        const isDifferentPath = url.pathname !== pathname
        const isInternal = anchor.target !== "_blank" && !anchor.rel?.includes("external")
        if (isSameOrigin && isDifferentPath && isInternal) startProgress()
      } catch {
        // invalid href — ignore
      }
    }
    document.addEventListener("click", handleClick)
    return () => document.removeEventListener("click", handleClick)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  /* ── source 2: programmatic router.push() via emitNavStart() ── */
  useEffect(() => {
    return onNavStart((_href) => startProgress())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ── pathname changed → complete bar ── */
  useEffect(() => {
    if (prevPathname.current === pathname) return
    prevPathname.current = pathname
    if (state === "loading") {
      clear()
      startTransition(() => {
        setWidth(100)
        setState("done")
      })
      timers.current = [
        setTimeout(() => {
          setState("idle")
          setWidth(0)
        }, 400),
      ]
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  /* ── cleanup on unmount ── */
  useEffect(() => clear, [])

  if (state === "idle") return null

  return (
    <div className="fixed inset-x-0 top-0 z-[9999] h-[2px] pointer-events-none">
      {/* fill */}
      <div
        className="absolute inset-y-0 start-0 h-full bg-primary shadow-[0_0_8px_1px_hsl(var(--primary)/0.6)]"
        style={{ width: `${width}%` }}
      />

      {/* leading glow dot */}
      <div
        className="absolute top-1/2 -translate-y-1/2 h-[6px] w-[6px] rounded-full bg-primary shadow-[0_0_6px_3px_hsl(var(--primary)/0.5)]"
        style={{ insetInlineStart: `calc(${width}% - 3px)` }}
      />
    </div>
  )
}
