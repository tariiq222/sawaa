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
  const [failed, setFailed] = useState(false)
  const safeAvatarUrl = normalizeEmployeeAvatarSrc(avatarUrl)

  if (safeAvatarUrl && !failed) {
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
            onError={() => setFailed(true)}
          />
        ) : (
          <Image
            src={safeAvatarUrl}
            alt={name}
            fill
            className="object-cover"
            sizes="36px"
            onError={() => setFailed(true)}
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
