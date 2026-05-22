"use client"

import { ReactNode } from "react"
import { useLocale } from "@/components/locale-provider"

interface EmptyStateProps {
  title?: string
  description?: string
  action?: ReactNode
}

export function ReportsEmptyState({
  title,
  description,
  action,
}: EmptyStateProps) {
  const { t } = useLocale()
  return (
    <div
      className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-surface px-6 py-10 text-center"
      data-testid="report-empty"
    >
      <p className="text-sm font-medium text-foreground">
        {title ?? t("reports.empty.title")}
      </p>
      <p className="max-w-md text-xs text-muted-foreground">
        {description ?? t("reports.empty.description")}
      </p>
      {action}
    </div>
  )
}
