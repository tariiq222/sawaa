"use client"

import { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface SectionProps {
  title?: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
}

export function Section({
  title,
  subtitle,
  actions,
  children,
  className,
}: SectionProps) {
  return (
    <section
      className={cn(
        "rounded-xl border border-border bg-surface p-5",
        className,
      )}
      data-testid="report-section"
    >
      {(title || actions) && (
        <header className="mb-4 flex items-start justify-between gap-4">
          <div>
            {title && (
              <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            )}
            {subtitle && (
              <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
          {actions && <div className="shrink-0">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  )
}
