import * as React from "react"

import { cn } from "../lib/cn"

export type SurfaceRowVariant = "default" | "muted" | "dashed"
export type SurfaceRowSize = "sm" | "md"

export interface SurfaceRowProps
  extends React.HTMLAttributes<HTMLDivElement> {
  variant?: SurfaceRowVariant
  size?: SurfaceRowSize
}

export function SurfaceRow({
  className,
  variant = "default",
  size = "md",
  ...props
}: SurfaceRowProps) {
  return (
    <div
      data-slot="surface-row"
      data-variant={variant}
      data-size={size}
      className={cn(
        "rounded-xl border border-border shadow-sm",
        variant === "default" && "bg-card",
        variant === "muted" && "bg-surface-muted",
        variant === "dashed" && "border-dashed bg-transparent",
        size === "sm" && "px-3 py-2",
        size === "md" && "px-4 py-3",
        className
      )}
      {...props}
    />
  )
}