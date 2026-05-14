"use client"

import { useState } from "react"
import { useSearchParams } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Add01Icon,
  Calendar03Icon,
  Clock01Icon,
  CheckmarkCircle02Icon,
  Money02Icon,
} from "@hugeicons/core-free-icons"

import { ListPageShell } from "@/components/features/list-page-shell"
import { Button } from "@deqah/ui"
import { Skeleton } from "@deqah/ui"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@deqah/ui"
import { Breadcrumbs } from "@/components/features/breadcrumbs"
import { PageHeader } from "@/components/features/page-header"
import { StatsGrid } from "@/components/features/stats-grid"
import { StatCard } from "@/components/features/stat-card"
import { BookingDetailSheet } from "@/components/features/bookings/booking-detail-sheet"
import { BookingCreateDialog } from "@/components/features/bookings/booking-create-dialog"
import { WaitlistTab } from "@/components/features/bookings/waitlist-tab"
import { BookingsTabContent } from "@/components/features/bookings/bookings-tab-content"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { useLocale } from "@/components/locale-provider"
import { useBookingsStats } from "@/hooks/use-bookings"
import { useAuth } from "@/components/providers/auth-provider"
import { useTerminology } from "@/hooks/use-terminology"
import type { Booking } from "@/lib/types/booking"
import type { BookingSettings } from "@/lib/api/booking-settings"

interface BookingsPageContentProps {
  bookingSettings: BookingSettings | null
}

export function BookingsPageContent({
  bookingSettings,
}: BookingsPageContentProps) {
  const searchParams = useSearchParams()
  const tabParam = searchParams.get("tab")
  const defaultTab = tabParam === "waitlist" ? "waitlist" : "bookings"
  const { t } = useLocale()
  const { user } = useAuth()
  // "المواعيد"/"Appointments" for clinical, "الحصص"/"Classes" for fitness, …
  const { t: term } = useTerminology(user?.verticalSlug ?? undefined)
  const titleLabel = term("appointment.plural", t("nav.bookings"))
  const queryClient = useQueryClient()
  const { data: stats, isLoading: statsLoading } = useBookingsStats()

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.bookings.all })

  const [createOpen, setCreateOpen] = useState(false)
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailDefaultTab, setDetailDefaultTab] = useState<
    "details" | "reschedule"
  >("details")

  const handleRowClick = (booking: Booking) => {
    setDetailDefaultTab("details")
    setSelectedBooking(booking)
    setDetailOpen(true)
  }

  const handleEditClick = (booking: Booking) => {
    setDetailDefaultTab("reschedule")
    setSelectedBooking(booking)
    setDetailOpen(true)
  }

  return (
    <ListPageShell>
      <div className="flex flex-col gap-2">
        <Breadcrumbs />
        <PageHeader
          title={titleLabel}
          description={t("bookings.description")}
        >
          <Button
            className="gap-2 rounded-full px-5"
            onClick={() => setCreateOpen(true)}
          >
            <HugeiconsIcon icon={Add01Icon} size={16} />
            {t("bookings.newBooking")}
          </Button>
        </PageHeader>
      </div>

      {statsLoading ? (
        <StatsGrid>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={`skeleton-${i}`} className="h-[100px] w-full rounded-xl" />
          ))}
        </StatsGrid>
      ) : (
        <StatsGrid>
          <StatCard
            title={t("bookings.stats.today")}
            value={stats?.todayCount ?? 0}
            description={t("bookings.stats.todayDesc")}
            icon={Calendar03Icon}
            iconColor="primary"
          />
          <StatCard
            title={t("bookings.stats.pending")}
            value={stats?.pendingCount ?? 0}
            description={t("bookings.stats.pendingDesc")}
            icon={Clock01Icon}
            iconColor="warning"
          />
          <StatCard
            title={t("bookings.stats.completedToday")}
            value={stats?.completedToday ?? 0}
            description={t("bookings.stats.completedTodayDesc")}
            icon={CheckmarkCircle02Icon}
            iconColor="success"
          />
          <StatCard
            title={t("bookings.stats.revenueToday")}
            value={`${(stats?.revenueToday ?? 0).toFixed(2)} ${t("bookings.wizard.step.service.currency")}`}
            description={t("bookings.stats.revenueTodayDesc")}
            icon={Money02Icon}
            iconColor="accent"
          />
        </StatsGrid>
      )}

      <Tabs defaultValue={defaultTab}>
        <TabsList>
          <TabsTrigger value="bookings">{t("bookings.tabs.list")}</TabsTrigger>
          {bookingSettings?.waitlistEnabled && (
            <TabsTrigger value="waitlist">
              {t("bookings.tabs.waitlist")}
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="bookings" className="mt-4">
          <BookingsTabContent
            onRowClick={handleRowClick}
            onEditClick={handleEditClick}
          />
        </TabsContent>

        {bookingSettings?.waitlistEnabled && (
          <TabsContent value="waitlist" className="mt-4">
            <WaitlistTab />
          </TabsContent>
        )}
      </Tabs>

      <BookingCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSuccess={refresh}
      />

      <BookingDetailSheet
        booking={selectedBooking}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onAction={() => {
          setDetailOpen(false)
          refresh()
        }}
        defaultTab={detailDefaultTab}
      />
    </ListPageShell>
  )
}
