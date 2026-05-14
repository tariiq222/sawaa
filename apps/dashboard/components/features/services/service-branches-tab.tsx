"use client"

import { useLocale } from "@/components/locale-provider"

/* ─── Props ─── */

interface ServiceBranchesTabProps {
  serviceId?: string | undefined
}

/* ─── Component ─── */

export function ServiceBranchesTab(_props: ServiceBranchesTabProps) {
  const { t } = useLocale()
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface-muted p-6">
      <p className="text-sm font-semibold text-foreground">
        {t("services.branches.title")}
      </p>
      <p className="text-sm text-muted-foreground">
        {t("services.branches.description")}
      </p>
    </div>
  )
}
