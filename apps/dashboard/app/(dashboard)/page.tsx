"use client"

import { Suspense, useMemo } from "react"
import { format } from "date-fns"
import { ar } from "date-fns/locale"
import { FlashIcon } from "@hugeicons/core-free-icons"
import { GreetingHeader } from "@/components/features/dashboard/greeting-header"
import { QuickActions } from "@/components/features/dashboard/quick-actions"
import { HomeStats } from "@/components/features/dashboard/home-stats"
import { AttentionAlerts } from "@/components/features/dashboard/attention-alerts"
import { SectionHeader } from "@/components/features/section-header"
import { useAuth } from "@/components/providers/auth-provider"
import { useLocale } from "@/components/locale-provider"
import { getVisibleWidgets } from "@/lib/dashboard-widgets"
import { useDashboardHome } from "@/hooks/use-dashboard-home"

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

  const {
    overview,
    todayBookingsCount,
    pendingPaymentsCount,
    cancelRequestsCount,
    isLoading,
  } = useDashboardHome(visible)

  return (
    <div className="flex flex-col gap-8 animate-in fade-in duration-300">
      <Suspense fallback={<div className="h-20 animate-pulse rounded-2xl bg-muted" />}>
        <section className="flex flex-col gap-5">
          <GreetingHeader
            userName={userName}
            dateLabel={dateLabel}
            bookingsCount={todayBookingsCount}
          />
        </section>
      </Suspense>

      <AttentionAlerts
        pendingPayments={pendingPaymentsCount}
        cancelRequests={cancelRequestsCount}
        visible={visible.attentionAlerts}
      />

      <HomeStats
        overview={overview}
        pendingPayments={pendingPaymentsCount}
        visible={visible.stats}
        isLoading={isLoading}
      />

      {visible.quickActions.length > 0 && (
        <section className="flex flex-col gap-4">
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
