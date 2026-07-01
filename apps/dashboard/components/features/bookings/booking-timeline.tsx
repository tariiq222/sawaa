"use client"

import { useQuery } from "@tanstack/react-query"
import { arSA, enUS } from "date-fns/locale"

import { Skeleton } from "@sawaa/ui"
import { useLocale } from "@/components/locale-provider"
import { queryKeys } from "@/lib/query-keys"
import { fetchBookingTimeline, type BookingTimelineEntry } from "@/lib/api/bookings"
import { formatDatePattern } from "@/lib/date"
import { FormattedCurrency } from "@/components/features/shared/sar-symbol"
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

const DOT_COLORS: Record<BookingTimelineEntry["kind"], string> = {
  CREATED:       "bg-primary",
  STATUS_CHANGE: "bg-primary",
  RESCHEDULE:    "bg-primary",
  PAYMENT:       "bg-success",
  REFUND:        "bg-warning",
  ACTIVITY:      "bg-muted-foreground",
}

interface BookingTimelineProps {
  bookingId: string
}

export function BookingTimeline({ bookingId }: BookingTimelineProps) {
  const { t, locale } = useLocale()
  const dateLocale = locale === "ar" ? arSA : enUS

  const { data: entries, isLoading } = useQuery({
    queryKey: queryKeys.bookings.timeline(bookingId),
    queryFn: () => fetchBookingTimeline(bookingId),
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

  if (!entries || !Array.isArray(entries) || !entries.length) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        {t("bookings.timeline.empty")}
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {entries.map((entry, idx) => (
        <div
          key={entry.id}
          className="flex items-start gap-3 rounded-lg border border-border bg-card p-3"
        >
          {/* Timeline dot + connector */}
          <div className="mt-1 flex flex-col items-center gap-1">
            <div className={`h-2 w-2 rounded-full ${DOT_COLORS[entry.kind]}`} />
            {idx < entries.length - 1 && (
              <div className="h-full w-px bg-border" style={{ minHeight: 16 }} />
            )}
          </div>

          <div className="flex flex-1 flex-col gap-1 min-w-0">
            <TimelineHeadline entry={entry} t={t} locale={locale} />

            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="tabular-nums">
                {formatDatePattern(entry.at, "MMM d, yyyy HH:mm", { locale: dateLocale })}
              </span>
              {entry.actor && (
                <span className="truncate max-w-[200px]" title={entry.actor}>
                  {t("bookings.timeline.by")} {entry.actor}
                </span>
              )}
              {entry.reason && (
                <span className="truncate max-w-[220px]" title={entry.reason}>
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

function StatusChip({ raw, t }: { raw: string; t: (k: string) => string }) {
  return (
    <span
      className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-medium ${STATUS_COLORS[raw.toLowerCase()] ?? "bg-muted text-muted-foreground border-border"}`}
    >
      {t(statusKey(raw))}
    </span>
  )
}

function TimelineHeadline({
  entry,
  t,
  locale,
}: {
  entry: BookingTimelineEntry
  t: (k: string) => string
  locale: "ar" | "en"
}) {
  if (entry.kind === "STATUS_CHANGE") {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        {entry.fromStatus && (
          <>
            <StatusChip raw={entry.fromStatus} t={t} />
            <span className="text-xs text-muted-foreground">→</span>
          </>
        )}
        {entry.toStatus && <StatusChip raw={entry.toStatus} t={t} />}
      </div>
    )
  }

  if (entry.kind === "RESCHEDULE") {
    const dateLocale = locale === "ar" ? arSA : enUS
    const from = entry.meta?.fromScheduledAt
    const to = entry.meta?.toScheduledAt
    const fmt = (iso: string) =>
      formatDatePattern(iso, "MMM d, yyyy HH:mm", { locale: dateLocale })
    return (
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium text-foreground">
          {t("bookings.timeline.rescheduled")}
        </span>
        {from && to && (
          <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
            <span>{fmt(from)}</span>
            <span>→</span>
            <span className="text-foreground">{fmt(to)}</span>
          </span>
        )}
      </div>
    )
  }

  if (entry.kind === "PAYMENT" || entry.kind === "REFUND") {
    const isPayment = entry.kind === "PAYMENT"
    const statusKeyRaw = isPayment ? entry.paymentStatus : entry.refundStatus
    const statusGroup = isPayment ? "paymentStatus" : "refundStatus"
    return (
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium text-foreground">
          {t(isPayment ? "bookings.timeline.payment" : "bookings.timeline.refund")}
        </span>
        {entry.amount != null && (
          <span className="tabular-nums text-foreground">
            <FormattedCurrency amount={entry.amount} locale={locale} decimals={2} />
          </span>
        )}
        {entry.method && (
          <span className="text-xs text-muted-foreground">
            {t(`bookings.timeline.method.${entry.method}`)}
          </span>
        )}
        {statusKeyRaw && (
          <span className="text-xs text-muted-foreground">
            {t(`bookings.timeline.${statusGroup}.${statusKeyRaw}`)}
          </span>
        )}
      </div>
    )
  }

  // CREATED / ACTIVITY
  return (
    <span className="text-sm font-medium text-foreground">
      {t(entry.kind === "CREATED" ? "bookings.timeline.created" : "bookings.timeline.activity")}
    </span>
  )
}
