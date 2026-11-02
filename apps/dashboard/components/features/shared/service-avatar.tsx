"use client"

import { useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import * as HugeIcons from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"

interface ServiceAvatarProps {
  iconName?: string | null
  iconBgColor?: string | null
  imageUrl?: string | null
  name?: string
  size?: "sm" | "md" | "lg"
  className?: string
}

const sizes = {
  sm: { outer: "h-8 w-8", text: "text-xs", icon: 14 },
  md: { outer: "h-12 w-12", text: "text-sm", icon: 20 },
  lg: { outer: "h-16 w-16", text: "text-base", icon: 28 },
}

export function ServiceAvatar({
  iconName,
  iconBgColor,
  imageUrl,
  name,
  size = "sm",
  className,
}: ServiceAvatarProps) {
  const s = sizes[size]
  const initial = name?.trim()?.[0]?.toUpperCase() ?? "S"

  // Remember *which* URL failed rather than a bare boolean: when `imageUrl`
  // changes the state no longer matches and the new image is attempted.
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null)
  const hasImage = imageUrl !== null && imageUrl !== undefined && imageUrl !== ""
  const showImage = hasImage && imageUrl !== failedImageUrl

  // Priority 1: image (falls back to icon/placeholder on load error)
  if (showImage) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt={name ?? "service"}
        className={cn("rounded-full object-cover shrink-0", s.outer, className)}
        onError={() => setFailedImageUrl(imageUrl)}
      />
    )
  }

  // Priority 2: icon + bg color
  if (iconName) {
    const icon = (HugeIcons as Record<string, unknown>)[iconName]
    return (
      <div
        className={cn("flex items-center justify-center rounded-full shrink-0", s.outer, className)}
        style={{ backgroundColor: iconBgColor ?? "var(--primary)" }}
      >
        {icon ? (
          <HugeiconsIcon
            icon={icon as Parameters<typeof HugeiconsIcon>[0]["icon"]}
            size={s.icon}
            color="white"
          />
        ) : (
          <span className={cn("font-semibold text-white", s.text)}>{initial}</span>
        )}
      </div>
    )
  }

  // Priority 3: placeholder
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-full shrink-0 bg-primary",
        s.outer,
        className,
      )}
    >
      <span className={cn("font-semibold text-primary-foreground", s.text)}>{initial}</span>
    </div>
  )
}
