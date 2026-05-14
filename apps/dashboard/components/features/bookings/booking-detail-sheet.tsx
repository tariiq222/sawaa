"use client"

import React from "react"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@deqah/ui"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@deqah/ui"

import { StatusBadge, BookingTypeBadge } from "@/components/features/status-badge"
import { useLocale } from "@/components/locale-provider"
import { useOrganizationConfig } from "@/hooks/use-organization-config"
import type { Booking } from "@/lib/types/booking"
import { BookingActions } from "./booking-actions"
import { DetailsBody } from "./booking-details-body"
import { BookingRescheduleTab } from "./booking-reschedule-tab"
import { BookingStatusLog } from "./booking-status-log"

/* ── Props ── */

interface BookingDetailSheetProps {
  booking: Booking | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onAction: () => void
  defaultTab?: "details" | "reschedule"
}

/* ── Main Dialog ── */

export function BookingDetailSheet({ booking, open, onOpenChange, onAction, defaultTab = "details" }: BookingDetailSheetProps) {
  const { locale, t } = useLocale()
  const { formatDate } = useOrganizationConfig()

  if (!booking) return null

  const clientName = booking.client
    ? `${booking.client.firstName} ${booking.client.lastName}`
    : "—"

  const employeeName = booking.employee?.user
    ? `${booking.employee.user.firstName} ${booking.employee.user.lastName}`
    : "—"

  const specialty = (locale === "ar"
    ? booking.employee?.specialtyAr
    : booking.employee?.specialty) || "—"

  const appointmentDate = formatDate(booking.date)

  const canReschedule = !["completed", "cancelled", "no_show", "cancel_requested", "expired"].includes(booking.status)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden flex flex-col">

        {/* Header */}
        <DialogHeader>
          <div className="flex items-center justify-between gap-3">
            <DialogTitle className="text-base font-semibold text-foreground">
              {t("detail.bookingDetails")}
            </DialogTitle>
            <BookingActions booking={booking} onAction={onAction} />
          </div>
          <DialogDescription asChild>
            <div className="flex items-center justify-between gap-3 mt-1">
              <div className="flex items-center gap-2">
                <BookingTypeBadge type={booking.type} />
                <StatusBadge status={booking.status} />
              </div>
            </div>
          </DialogDescription>
        </DialogHeader>

        {/* Body */}
        <div className="flex-1 overflow-y-auto bg-surface-muted">
          {canReschedule ? (
            <Tabs defaultValue={defaultTab} className="h-full">
              <div className="px-6 pt-4">
                <TabsList className="h-8 p-0.5">
                  <TabsTrigger value="details" className="h-7 px-3 text-xs">{t("detail.tabs.details")}</TabsTrigger>
                  <TabsTrigger value="reschedule" className="h-7 px-3 text-xs">{t("detail.tabs.reschedule")}</TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="details" className="px-6 pt-4 pb-6 flex flex-col gap-6">
                <DetailsBody
                  booking={booking}
                  clientName={clientName}
                  employeeName={employeeName}
                  specialty={specialty}
                  appointmentDate={appointmentDate}
                  t={t}
                  locale={locale}
                />
                <div className="flex flex-col gap-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t("bookings.statusLog.title")}
                  </p>
                  <BookingStatusLog bookingId={booking.id} />
                </div>
              </TabsContent>

              <TabsContent value="reschedule" className="px-6 pt-4 pb-6">
                <BookingRescheduleTab
                  booking={booking}
                  onSuccess={() => { onOpenChange(false); onAction() }}
                />
              </TabsContent>
            </Tabs>
          ) : (
            <div className="px-6 pt-4 pb-6 flex flex-col gap-6">
              <DetailsBody
                booking={booking}
                clientName={clientName}
                employeeName={employeeName}
                specialty={specialty}
                appointmentDate={appointmentDate}
                t={t}
                locale={locale}
              />
              <div className="flex flex-col gap-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("bookings.statusLog.title")}
                </p>
                <BookingStatusLog bookingId={booking.id} />
              </div>
            </div>
          )}
        </div>

      </DialogContent>
    </Dialog>
  )
}
