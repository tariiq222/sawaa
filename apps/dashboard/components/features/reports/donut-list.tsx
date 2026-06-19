"use client"

import { ReactNode } from "react"
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts"
import { cn } from "@/lib/utils"

export interface DonutItem {
  key: string
  label: string
  value: number
  color: string
  /** Optional formatted amount displayed on the right */
  amount?: ReactNode
}

interface DonutListProps {
  items: DonutItem[]
  centerLabel?: string
  centerValue?: string | number
  size?: number
}

export function DonutList({
  items,
  centerLabel,
  centerValue,
  size = 140,
}: DonutListProps) {
  const total = items.reduce((s, i) => s + i.value, 0)
  return (
    <div className="flex items-center gap-5">
      <div
        className="relative shrink-0"
        style={{ width: size, height: size, direction: "ltr" }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={items.length > 0 ? items : [{ key: "empty", value: 1 }]}
              dataKey="value"
              innerRadius="70%"
              outerRadius="100%"
              startAngle={90}
              endAngle={-270}
              isAnimationActive={false}
            >
              {(items.length > 0 ? items : [{ color: "var(--muted)" }]).map(
                (item, i) => (
                  <Cell
                    key={i}
                    fill={(item as DonutItem).color ?? "var(--muted)"}
                  />
                ),
              )}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        {(centerLabel || centerValue !== undefined) && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            {centerValue !== undefined && (
              <span className="text-base font-bold tabular-nums text-foreground">
                {centerValue}
              </span>
            )}
            {centerLabel && (
              <span className="text-[10px] text-muted-foreground">
                {centerLabel}
              </span>
            )}
          </div>
        )}
      </div>
      <div className="flex-1 space-y-1.5">
        {items.length === 0 && (
          <p className="text-sm text-muted-foreground">—</p>
        )}
        {items.map((item) => {
          const pct = total > 0 ? Math.round((item.value / total) * 100) : 0
          return (
            <div
              key={item.key}
              className="flex items-center justify-between gap-3 border-b border-border py-1 text-sm last:border-b-0"
            >
              <span className="flex items-center gap-2 text-foreground">
                <span
                  className="inline-block size-2 rounded-sm"
                  style={{ background: item.color }}
                  aria-hidden
                />
                {item.label}
              </span>
              <span
                className={cn(
                  "flex items-center gap-2 tabular-nums",
                  "text-muted-foreground",
                )}
              >
                {item.amount && (
                  <span className="font-medium text-foreground">{item.amount}</span>
                )}
                <span className="text-xs">({pct}%)</span>
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
