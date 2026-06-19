"use client"

import { Button } from "@sawaa/ui"
import { cn } from "@/lib/utils"
import { useLocale } from "@/components/locale-provider"
import { AlertCircleIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

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
      role="alert"
      className={cn(
        "rounded-lg border border-error/30 bg-error-soft p-4 flex items-start gap-3",
        className
      )}
    >
      <HugeiconsIcon icon={AlertCircleIcon} size={16} className="mt-0.5 shrink-0 text-error" aria-hidden />
      <div className="flex flex-col gap-2">
        <p className="text-sm text-error">{message}</p>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            {label}
          </Button>
        )}
      </div>
    </div>
  )
}
