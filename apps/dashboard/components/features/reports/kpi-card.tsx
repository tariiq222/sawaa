"use client"

import { ReactNode } from "react"
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

const TONE_ICON: Record<KpiDeltaTone, string> = {
  up: "↑",
  down: "↓",
  flat: "—",
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
          <span aria-hidden>{TONE_ICON[delta.tone]}</span>
          {delta.text}
        </span>
      )}
    </div>
  )
}
