"use client"

import { useState } from "react"
import Image from "next/image"
import { HugeiconsIcon } from "@hugeicons/react"
import { UserIcon } from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"

/* ─── Normalizer ─── */

export function normalizeEmployeeAvatarSrc(avatarUrl: unknown): string | null {
  if (typeof avatarUrl !== "string") return null
  const trimmed = avatarUrl.trim()
  if (!trimmed) return null

  try {
    const url = new URL(trimmed, "http://localhost")
    if (url.protocol !== "http:" && url.protocol !== "https:") return null
    if (trimmed.startsWith("/") && !trimmed.startsWith("//")) return url.pathname + url.search + url.hash
    return /^https?:\/\//i.test(trimmed) ? trimmed : null
  } catch {
    return null
  }
}

/* ─── Avatar ─── */

interface EmployeeAvatarProps {
  avatarUrl: string | null | undefined
  name: string
  className?: string
}

export function EmployeeAvatar({ avatarUrl, name, className }: EmployeeAvatarProps) {
  // Track the exact src that failed, not a bare boolean: a new `avatarUrl`
  // no longer matches, so the next image is attempted instead of being
  // permanently suppressed by the first failure.
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const safeAvatarUrl = normalizeEmployeeAvatarSrc(avatarUrl)
  const showImage = safeAvatarUrl !== null && safeAvatarUrl !== failedSrc

  if (showImage) {
    const isRemote = /^https?:\/\//i.test(safeAvatarUrl)
    return (
      <div className={cn("relative size-9 shrink-0 overflow-hidden rounded-full", className)}>
        {isRemote ? (
          // Remote avatars bypass next/image — no remotePatterns configured
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={safeAvatarUrl}
            alt={name}
            className="size-full object-cover"
            onError={() => setFailedSrc(safeAvatarUrl)}
          />
        ) : (
          <Image
            src={safeAvatarUrl}
            alt={name}
            fill
            className="object-cover"
            sizes="36px"
            onError={() => setFailedSrc(safeAvatarUrl)}
          />
        )}
      </div>
    )
  }

  return (
    <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10", className)}>
      <HugeiconsIcon icon={UserIcon} size={18} className="text-primary" />
    </div>
  )
}
