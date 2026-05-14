"use client"

import { Button } from "@deqah/ui"
import { cn } from "@/lib/utils"
import { useLocale } from "@/components/locale-provider"

interface ErrorBannerProps {
  message: string
  onRetry?: () => void
  retryLabel?: string
  className?: string
}

export function ErrorBanner({
  message,
  onRetry,
  retryLabel,
  className,
}: ErrorBannerProps) {
  const { t } = useLocale()
  const label = retryLabel ?? t("common.retry")

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card p-4",
        className
      )}
    >
      <p className="text-sm text-error">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-2" onClick={onRetry}>
          {label}
        </Button>
      )}
    </div>
  )
}
