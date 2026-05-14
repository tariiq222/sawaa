"use client"

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

  // Priority 1: image
  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt={name ?? "service"}
        className={cn("rounded-full object-cover shrink-0", s.outer, className)}
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
