// EXCEPTION: dashboard range filter state, approved 2026-05-17
"use client"

import { Suspense, useMemo, useState } from "react"
import { format, startOfWeek, startOfMonth } from "date-fns"
import { ar } from "date-fns/locale"
import { FlashIcon } from "@hugeicons/core-free-icons"
import { GreetingHeader } from "@/components/features/dashboard/greeting-header"
import { DashboardStats } from "@/components/features/dashboard/dashboard-stats"
import { AttentionAlerts } from "@/components/features/dashboard/attention-alerts"
import { QuickActions } from "@/components/features/dashboard/quick-actions"
import { SectionHeader } from "@/components/features/section-header"
import { useDashboardStats } from "@/hooks/use-dashboard-stats"
import { useAuth } from "@/components/providers/auth-provider"
import { useLocale } from "@/components/locale-provider"
import { getVisibleWidgets } from "@/lib/dashboard-widgets"
import { StatsRangeFilter, type StatsRangePreset } from "@/components/features/dashboard/stats-range-filter"

export default function DashboardPage() {
  const today = format(new Date(), "yyyy-MM-dd")
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

  const [preset, setPreset] = useState<StatsRangePreset>("today")
  const [customFrom, setCustomFrom] = useState("")
  const [customTo, setCustomTo] = useState("")

  const range = useMemo(() => {
    const now = new Date()
    if (preset === "today") return { from: today, to: today }
    if (preset === "week")
      return { from: format(startOfWeek(now, { weekStartsOn: 6 }), "yyyy-MM-dd"), to: today }
    if (preset === "month")
      return { from: format(startOfMonth(now), "yyyy-MM-dd"), to: today }
    return { from: customFrom || today, to: customTo || today }
  }, [preset, customFrom, customTo, today])

  const handleFromChange = (v: string) => { setCustomFrom(v); setPreset("custom") }
  const handleToChange = (v: string) => { setCustomTo(v); setPreset("custom") }
  const handleReset = () => { setPreset("today"); setCustomFrom(""); setCustomTo("") }

  const { data: dashboardStats } = useDashboardStats(range)

  const userName = user?.name || user?.email || "—"

  return (
    <div className="flex flex-col">
      <Suspense fallback={<div className="h-48 animate-pulse rounded-xl bg-muted" />}>
        <section className="flex flex-col gap-5">
          <GreetingHeader
            userName={userName}
            dateLabel={dateLabel}
            bookingsCount={dashboardStats?.todayBookings ?? 0}
          />
          <StatsRangeFilter
            preset={preset}
            from={range.from}
            to={range.to}
            onPresetChange={setPreset}
            onFromChange={handleFromChange}
            onToChange={handleToChange}
            onReset={handleReset}
          />
          <DashboardStats stats={dashboardStats} visibleStats={visible.stats} />
          <AttentionAlerts
            pendingPayments={dashboardStats?.pendingPayments ?? 0}
            cancelRequests={dashboardStats?.cancelRequests ?? 0}
            visible={visible.attentionAlerts}
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
