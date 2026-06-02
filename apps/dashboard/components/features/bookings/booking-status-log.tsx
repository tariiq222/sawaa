"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { Skeleton } from "@sawaa/ui"
import { useLocale } from "@/components/locale-provider"
import { fetchBookingStatusLog } from "@/lib/api/bookings"
import { arSA, enUS } from "date-fns/locale"
import { formatDatePattern } from "@/lib/date"
import { statusTranslationKeys } from "@/components/features/status-badge"
import type { BookingStatus } from "@/lib/types/booking"

/** Backend returns the Prisma enum (UPPERCASE); the UI keys are lowercase. */
function statusKey(raw: string): string {
  const lower = raw.toLowerCase()
  return statusTranslationKeys[lower as BookingStatus] ?? `bookings.status.${lower}`
}

const STATUS_COLORS: Record<string, string> = {
  pending:              "bg-warning/10 text-warning border-warning/20",
  pending_group_fill:   "bg-warning/10 text-warning border-warning/20",
  awaiting_payment:     "bg-warning/10 text-warning border-warning/20",
  confirmed:            "bg-success/10 text-success border-success/20",
  completed:            "bg-success/10 text-success border-success/20",
  cancelled:            "bg-error/10 text-error border-error/20",
  cancel_requested:     "bg-warning/10 text-warning border-warning/20",
  no_show:              "bg-error/10 text-error border-error/20",
  expired:              "bg-muted text-muted-foreground border-border",
}

interface BookingStatusLogProps {
  bookingId: string
}

export function BookingStatusLog({ bookingId }: BookingStatusLogProps) {
  const { t, locale } = useLocale()
  const dateLocale = locale === "ar" ? arSA : enUS

  const { data: logs, isLoading } = useQuery({
    queryKey: queryKeys.bookings.statusLog(bookingId),
    queryFn: () => fetchBookingStatusLog(bookingId),
    enabled: !!bookingId,
    staleTime: 30_000,
  })

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={`skeleton-${i}`} className="h-14 rounded-lg" />
        ))}
      </div>
    )
  }

  if (!logs || !Array.isArray(logs) || !logs.length) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        {t("bookings.statusLog.empty")}
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {logs.map((entry, idx) => (
        <div
          key={entry.id}
          className="flex items-start gap-3 rounded-lg border border-border bg-card p-3"
        >
          {/* Timeline dot + connector */}
          <div className="mt-1 flex flex-col items-center gap-1">
            <div className="h-2 w-2 rounded-full bg-primary" />
            {idx < logs.length - 1 && (
              <div className="h-full w-px bg-border" style={{ minHeight: 16 }} />
            )}
          </div>

          <div className="flex flex-1 flex-col gap-1 min-w-0">
            {/* Status transition badges */}
            <div className="flex flex-wrap items-center gap-1.5">
              {entry.fromStatus && (
                <>
                  <span
                    className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-medium ${STATUS_COLORS[entry.fromStatus.toLowerCase()] ?? "bg-muted text-muted-foreground border-border"}`}
                  >
                    {t(statusKey(entry.fromStatus))}
                  </span>
                  <span className="text-xs text-muted-foreground">→</span>
                </>
              )}
              <span
                className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-medium ${STATUS_COLORS[entry.toStatus.toLowerCase()] ?? "bg-muted text-muted-foreground border-border"}`}
              >
                {t(statusKey(entry.toStatus))}
              </span>
            </div>

            {/* Timestamp + optional reason */}
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="tabular-nums">
                {formatDatePattern(entry.createdAt, "MMM d, yyyy HH:mm", {
                  locale: dateLocale,
                })}
              </span>
              {entry.reason && (
                <span
                  className="truncate max-w-[200px]"
                  title={entry.reason}
                >
                  {entry.reason}
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
