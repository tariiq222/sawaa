"use client"

import { ReactNode } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowUp01Icon, ArrowDown01Icon, MinusSignIcon } from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"

export type KpiDeltaTone = "up" | "down" | "flat"

interface KpiCardProps {
  label: string
  value: ReactNode
  delta?: {
    text: string
    tone: KpiDeltaTone
  }
  /** Optional fill behind the card (used for sticky highlights) */
  className?: string
}

const TONE_CLASS: Record<KpiDeltaTone, string> = {
  up: "bg-success/15 text-success",
  down: "bg-error/15 text-error",
  flat: "bg-muted text-muted-foreground",
}

export function KpiCard({ label, value, delta, className }: KpiCardProps) {
  return (
    <div
      className={cn(
        "relative rounded-xl border border-border bg-surface p-5",
        className,
      )}
      data-testid="report-kpi-card"
    >
      <p className="mb-2 text-xs font-medium text-muted-foreground">{label}</p>
      <div className="text-2xl font-bold tabular-nums tracking-tight text-foreground">
        {value}
      </div>
      {delta && (
        <span
          className={cn(
            "mt-2 inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium",
            TONE_CLASS[delta.tone],
          )}
        >
          {delta.tone === "up" && <HugeiconsIcon icon={ArrowUp01Icon} size={12} aria-hidden />}
          {delta.tone === "down" && <HugeiconsIcon icon={ArrowDown01Icon} size={12} aria-hidden />}
          {delta.tone === "flat" && <HugeiconsIcon icon={MinusSignIcon} size={12} aria-hidden />}
          {delta.text}
        </span>
      )}
    </div>
  )
}
