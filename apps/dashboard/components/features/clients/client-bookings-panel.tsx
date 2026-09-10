"use client"

import { useQuery } from "@tanstack/react-query"
import { Skeleton } from "@sawaa/ui"
import { Button } from "@sawaa/ui"
import { useState } from "react"
import { fetchBookings } from "@/lib/api/bookings"
import { queryKeys } from "@/lib/query-keys"
import { StatusBadge } from "@/components/features/status-badge"

interface ClientBookingsPanelProps {
  clientId: string
  t: (key: string) => string
  formatDate: (d: string) => string
}

export function ClientBookingsPanel({ clientId, t, formatDate }: ClientBookingsPanelProps) {
  const [page, setPage] = useState(1)
  const bookingsQuery = { page, limit: 20, clientId }
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.bookings.list(bookingsQuery),
    queryFn: () => fetchBookings(bookingsQuery),
    staleTime: 5 * 60 * 1000,
  })

  if (isLoading) return <Skeleton className="h-32 w-full" />

  if (error) {
    return (
      <div role="alert" className="flex flex-col items-center gap-3 py-8 text-center text-sm text-muted-foreground">
        <span>{t("error.server")}</span>
        <Button variant="outline" size="sm" onClick={() => void refetch()}>
          {t("common.retry")}
        </Button>
      </div>
    )
  }

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
      {data?.meta && data.meta.totalPages > 1 && (
        <div className="flex items-center justify-between pt-2 text-sm text-muted-foreground">
          <span className="tabular-nums">{t("table.page")} {data.meta.page} {t("table.of")} {data.meta.totalPages}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={!data.meta.hasPreviousPage} onClick={() => setPage(data.meta.page - 1)}>{t("table.previous")}</Button>
            <Button variant="outline" size="sm" disabled={!data.meta.hasNextPage} onClick={() => setPage(data.meta.page + 1)}>{t("table.next")}</Button>
          </div>
        </div>
      )}
    </div>
  )
}
