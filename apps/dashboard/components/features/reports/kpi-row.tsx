"use client"

import { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface KpiRowProps {
  children: ReactNode
  className?: string
}

export function KpiRow({ children, className }: KpiRowProps) {
  return (
    <div
      className={cn(
        "grid gap-3 sm:grid-cols-2 lg:grid-cols-4",
        className,
      )}
      data-testid="report-kpi-row"
    >
      {children}
    </div>
  )
}
