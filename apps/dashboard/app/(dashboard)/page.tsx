"use client"

import { Suspense, useMemo } from "react"
import { format } from "date-fns"
import { ar } from "date-fns/locale"
import { FlashIcon } from "@hugeicons/core-free-icons"
import { GreetingHeader } from "@/components/features/dashboard/greeting-header"
import { QuickActions } from "@/components/features/dashboard/quick-actions"
import { SectionHeader } from "@/components/features/section-header"
import { useAuth } from "@/components/providers/auth-provider"
import { useLocale } from "@/components/locale-provider"
import { getVisibleWidgets } from "@/lib/dashboard-widgets"

export default function DashboardPage() {
  const { user, canDo } = useAuth()
  const { locale, t } = useLocale()

  const userRole = user?.role ?? null
  const visible = useMemo(
    () => getVisibleWidgets(userRole, canDo),
    [userRole, canDo],
  )

  const dateLabel = format(
    new Date(),
    locale === "ar" ? "EEEE، d MMMM yyyy" : "EEEE, MMMM d, yyyy",
    locale === "ar" ? { locale: ar } : undefined,
  )

  const userName = user?.name || user?.email || "—"

  return (
    <div className="flex flex-col">
      <Suspense fallback={<div className="h-48 animate-pulse rounded-xl bg-muted" />}>
        <section className="flex flex-col gap-5">
          <GreetingHeader
            userName={userName}
            dateLabel={dateLabel}
            bookingsCount={0}
          />
        </section>
      </Suspense>

      {visible.quickActions.length > 0 && (
        <section className="mt-10 flex flex-col gap-4">
          <SectionHeader
            icon={FlashIcon}
            title={t("dashboard.quickActions")}
            eyebrow={t("dashboard.section.today")}
          />
          <QuickActions actions={visible.quickActions} />
        </section>
      )}
    </div>
  )
}
