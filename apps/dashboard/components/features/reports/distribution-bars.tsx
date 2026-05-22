"use client"

import { ReactNode } from "react"
import { cn } from "@/lib/utils"

export interface DistributionItem {
  key: string
  label: ReactNode
  value: number
  /** Optional formatted amount on the right (overrides plain value) */
  display?: ReactNode
  /** Override the bar color for this row */
  color?: string
}

interface DistributionBarsProps {
  items: DistributionItem[]
  /** If provided, percentages are computed against this number instead of sum */
  total?: number
  showPercentage?: boolean
}

export function DistributionBars({
  items,
  total: explicitTotal,
  showPercentage = true,
}: DistributionBarsProps) {
  const sum = items.reduce((s, i) => s + i.value, 0)
  const total = explicitTotal ?? sum

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">—</p>
  }

  return (
    <div className="flex flex-col gap-3">
      {items.map((item) => {
        const pct = total > 0 ? (item.value / total) * 100 : 0
        return (
          <div key={item.key}>
            <div className="mb-1.5 flex justify-between text-sm">
              <span className="text-foreground">{item.label}</span>
              <span className="font-medium tabular-nums text-foreground">
                {item.display ?? item.value}
                {showPercentage && (
                  <span className="ms-2 text-xs text-muted-foreground">
                    ({pct.toFixed(0)}%)
                  </span>
                )}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className={cn("h-full rounded-full")}
                style={{
                  width: `${Math.min(100, pct).toFixed(2)}%`,
                  background: item.color ?? "var(--primary)",
                }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
