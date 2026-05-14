"use client"

import { useEmailFallbackQuota } from "@/hooks/use-delivery-logs"
import { useLocale } from "@/components/locale-provider"

export function EmailFallbackQuotaBanner() {
  const { t } = useLocale()
  const { data, isLoading } = useEmailFallbackQuota()

  if (isLoading || !data) return null

  if (data.limit === -1) {
    return (
      <div className="mb-4 rounded-xl border border-border/60 bg-muted/40 px-4 py-3 text-sm">
        <p className="font-medium">{t("settings.emailFallbackQuota.title")}</p>
        <p className="text-muted-foreground mt-1">{t("settings.emailFallbackQuota.unlimited")}</p>
      </div>
    )
  }

  const pct = Math.min(100, Math.round((data.used / data.limit) * 100))
  const isNearLimit = pct >= 80
  const isAtLimit = data.used >= data.limit

  if (isAtLimit) {
    return (
      <div className="mb-4 rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm">
        <p className="font-medium text-destructive">{t("settings.emailFallbackQuota.title")}</p>
        <p className="text-destructive/80 mt-1">{t("settings.emailFallbackQuota.limitReached")}</p>
      </div>
    )
  }

  return (
    <div
      className={`mb-4 rounded-xl border px-4 py-3 text-sm ${
        isNearLimit
          ? "border-warning/40 bg-warning/5"
          : "border-border/60 bg-muted/40"
      }`}
    >
      <p className="font-medium">{t("settings.emailFallbackQuota.title")}</p>
      <p className="text-muted-foreground mt-1">{t("settings.emailFallbackQuota.desc")}</p>
      <p className="mt-2">
        {t("settings.emailFallbackQuota.usage")
          .replace("{used}", String(data.used))
          .replace("{limit}", String(data.limit))}
      </p>
      <div className="w-full bg-muted rounded-full h-1.5 mt-2">
        <div
          className={`h-1.5 rounded-full transition-all ${isNearLimit ? "bg-warning" : "bg-primary"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
