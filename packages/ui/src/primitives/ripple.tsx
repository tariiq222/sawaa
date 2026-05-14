"use client"

import { useCallback } from "react"

export function useRipple() {
  const createRipple = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const el = e.currentTarget
    const rect = el.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const size = Math.max(rect.width, rect.height)

    const ripple = document.createElement("span")
    ripple.style.cssText = `
      position: absolute;
      width: ${size}px;
      height: ${size}px;
      left: ${x - size / 2}px;
      top: ${y - size / 2}px;
      border-radius: 50%;
      background: radial-gradient(circle, color-mix(in srgb, var(--primary) 15%, transparent) 0%, color-mix(in srgb, var(--primary) 6%, transparent) 40%, transparent 70%);
      pointer-events: none;
      z-index: 10;
    `

    el.style.position = "relative"
    el.style.overflow = "hidden"
    el.appendChild(ripple)

    setTimeout(() => ripple.remove(), 0)
  }, [])

  return { createRipple }
}
