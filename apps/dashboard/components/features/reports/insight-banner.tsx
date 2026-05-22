"use client"

import { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface InsightBannerProps {
  children: ReactNode
  tone?: "info" | "success" | "warning"
  className?: string
}

const TONE: Record<NonNullable<InsightBannerProps["tone"]>, string> = {
  info: "bg-primary/10 border-primary/20 text-primary",
  success: "bg-success/10 border-success/20 text-success",
  warning: "bg-warning/10 border-warning/20 text-warning",
}

export function InsightBanner({
  children,
  tone = "info",
  className,
}: InsightBannerProps) {
  return (
    <div
      className={cn(
        "rounded-xl border p-3 text-sm",
        TONE[tone],
        className,
      )}
      data-testid="report-insight"
    >
      {children}
    </div>
  )
}
