"use client"

import { useQuery } from "@tanstack/react-query"
import { Skeleton } from "@sawaa/ui"
import { fetchBookings } from "@/lib/api/bookings"
import { queryKeys } from "@/lib/query-keys"
import { StatusBadge } from "@/components/features/status-badge"

interface ClientBookingsPanelProps {
  clientId: string
  t: (key: string) => string
  formatDate: (d: string) => string
}

export function ClientBookingsPanel({ clientId, t, formatDate }: ClientBookingsPanelProps) {
  const bookingsQuery = { page: 1, perPage: 20, clientId }
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.bookings.list(bookingsQuery),
    queryFn: () => fetchBookings(bookingsQuery),
    staleTime: 5 * 60 * 1000,
  })

  if (isLoading) return <Skeleton className="h-32 w-full" />

  const bookings = data?.items ?? []

  if (bookings.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        {t("clients.dialog.noBookings")}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {bookings.map((b) => (
        <div
          key={b.id}
          className="flex items-center justify-between rounded-lg border p-3"
        >
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium">
              {b.service?.nameAr ?? b.service?.nameEn ?? b.serviceId}
            </span>
            <span className="text-xs text-muted-foreground" dir="ltr">
              {formatDate(b.date)} {b.startTime}
            </span>
          </div>
          <StatusBadge status={b.status} />
        </div>
      ))}
    </div>
  )
}
