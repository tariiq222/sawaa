"use client"

import { useState } from "react"
import { useSearchParams } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon } from "@hugeicons/core-free-icons"

import { ListPageShell } from "@/components/features/list-page-shell"
import { Button } from "@sawaa/ui"
import { Breadcrumbs } from "@/components/features/breadcrumbs"
import { PageHeader } from "@/components/features/page-header"
import { BookingDetailSheet } from "@/components/features/bookings/booking-detail-sheet"
import { BookingCreateView } from "@/components/features/bookings/booking-create-view"
import { BookingsTabContent } from "@/components/features/bookings/bookings-tab-content"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { useLocale } from "@/components/locale-provider"
import type { Booking } from "@/lib/types/booking"

export function BookingsPageContent() {
  const searchParams = useSearchParams()
  const newParam = searchParams.get("new")
  const { t } = useLocale()
  const titleLabel = t("nav.bookings")
  const queryClient = useQueryClient()

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.bookings.all, refetchType: "all" })

  const [creating, setCreating] = useState(newParam === "1")
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailDefaultTab, setDetailDefaultTab] = useState<
    "details" | "reschedule" | "invoice"
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
          description={creating ? t("bookings.create.pageTitle") : t("bookings.description")}
        >
          {!creating && (
            <Button
              variant="accent"
              size="lg"
              className="gap-2 rounded-full px-6 shadow-md"
              onClick={() => setCreating(true)}
            >
              <HugeiconsIcon icon={Add01Icon} size={18} strokeWidth={2.5} />
              {t("bookings.newBooking")}
            </Button>
          )}
        </PageHeader>
      </div>

      {creating ? (
        <BookingCreateView
          onSuccess={() => { setCreating(false); refresh() }}
          onCancel={() => setCreating(false)}
        />
      ) : (
        <BookingsTabContent
          onRowClick={handleRowClick}
          onEditClick={handleEditClick}
        />
      )}

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
