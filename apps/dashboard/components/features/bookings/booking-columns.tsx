"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Globe02Icon,
  Store01Icon,
  Building02Icon,
  Video01Icon,
  UserIcon,
  WalkingIcon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons"
import { Avatar, AvatarFallback, Tooltip, TooltipContent, TooltipTrigger } from "@sawaa/ui"
import { cn, formatClinicDate, formatClinicTime } from "@/lib/utils"
import type { DateFormat } from "@/lib/utils"
import type { Booking } from "@/lib/types/booking"
import { FormattedCurrency } from "@/components/features/shared/sar-symbol"
import { ActionsCell, PaymentStatusCell, StatusCell } from "@/components/features/bookings/booking-column-cells"
import type { QuickStatusActionType } from "@/components/features/bookings/booking-column-cells"

function getInitials(first: string, last: string): string {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase()
}

const avatarGradients = [
  "from-avatar-1-from to-avatar-1-to",
  "from-avatar-2-from to-avatar-2-to",
  "from-avatar-3-from to-avatar-3-to",
  "from-avatar-4-from to-avatar-4-to",
  "from-avatar-5-from to-avatar-5-to",
  "from-avatar-6-from to-avatar-6-to",
  "from-avatar-7-from to-avatar-7-to",
  "from-avatar-8-from to-avatar-8-to",
]

function getGradient(name: string): string {
  let hash = 0
  for (const ch of name) hash = ch.charCodeAt(0) + ((hash << 5) - hash)
  return avatarGradients[Math.abs(hash) % avatarGradients.length]
}

/* Delivery icon — a glyph that names how the session is delivered at a glance:
   online → video, in-person (or unset) → building. Muted tone so it
   doesn't compete with the colored source chip beside it. */
const deliveryIconConfig: Record<string, { icon: typeof Building02Icon; labelKey: string }> = {
  ONLINE:    { icon: Video01Icon, labelKey: "bookings.col.type.online" },
  IN_PERSON: { icon: Building02Icon, labelKey: "bookings.col.type.inPerson" },
}

/* Booking-type icon — distinct from the delivery channel so receptionists can
   tell at a glance whether a row is an individual appointment, a walk-in, or a
   group session. Keys are the API-normalized lowercase codes used in the row's
   `type` field (e.g. "in_person" / "walk_in" / "group"); uppercase variants
   are handled defensively in the cell renderer. */
const bookingTypeIconConfig: Record<
  string,
  { icon: typeof UserIcon; labelKey: string }
> = {
  in_person: { icon: UserIcon,       labelKey: "bookings.col.type.inPerson" },
  walk_in:   { icon: WalkingIcon,    labelKey: "bookings.col.type.walkIn" },
  group:     { icon: UserGroupIcon,  labelKey: "bookings.col.type.group" },
}

function normalizeBookingType(raw: string | null | undefined): string | null {
  if (!raw) return null
  const lower = raw.toLowerCase()
  return bookingTypeIconConfig[lower] ? lower : null
}

/* Source icon — colored chip so the channel reads at a glance.
   RECEPTION → primary (teal, in-clinic), ONLINE → info (blue, web). */
const sourceIconConfig: Record<string, { icon: typeof Store01Icon; labelKey: string; tone: string }> = {
  RECEPTION: {
    icon: Store01Icon,
    labelKey: "bookings.col.source.reception",
    tone: "bg-primary-ultra-light text-primary border border-primary/20",
  },
  ONLINE: {
    icon: Globe02Icon,
    labelKey: "bookings.col.source.online",
    tone: "bg-info-soft text-info border border-info/30",
  },
}

/* ── Column definitions ── */

export function getBookingColumns(
  onRowClick: (booking: Booking, tab?: "details" | "reschedule" | "invoice") => void,
  onStatusAction: (booking: Booking, action: QuickStatusActionType) => void,
  onDelete: (booking: Booking) => void,
  t: (key: string) => string,
  config?: { dateFormat?: DateFormat; locale?: "ar" | "en" },
): ColumnDef<Booking>[] {
  const dateFormat = config?.dateFormat ?? "Y-m-d"
  const locale = config?.locale ?? "ar"
  return [
    {
      id: "bookingNumber",
      accessorFn: (row) => row.bookingNumber,
      sortingFn: "basic",
      header: "#",
      cell: ({ row }) => {
        const source = sourceIconConfig[row.original.source]
        const delivery = deliveryIconConfig[row.original.deliveryType ?? "IN_PERSON"]
        const deliveryLabel = delivery ? t(delivery.labelKey) : ""
        const bookingTypeKey = normalizeBookingType(row.original.type)
        const bookingType = bookingTypeKey
          ? bookingTypeIconConfig[bookingTypeKey]
          : null
        const bookingTypeLabel = bookingType ? t(bookingType.labelKey) : ""
        return (
          <div className="flex flex-col items-start gap-1.5">
            <span className="text-[13px] font-medium font-numeric text-muted-foreground">
              #{row.original.bookingNumber.toString().padStart(4, "0")}
            </span>
            <div className="flex items-center gap-1.5">
              {delivery && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      className="inline-flex size-5 items-center justify-center rounded-md bg-muted text-muted-foreground"
                      aria-label={deliveryLabel}
                    >
                      <HugeiconsIcon icon={delivery.icon} size={12} strokeWidth={2.4} />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top">{deliveryLabel}</TooltipContent>
                </Tooltip>
              )}
              {bookingType && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      className="inline-flex size-5 items-center justify-center rounded-md bg-primary-ultra-light text-primary border border-primary/20"
                      aria-label={bookingTypeLabel}
                      data-booking-type={bookingTypeKey}
                    >
                      <HugeiconsIcon icon={bookingType.icon} size={12} strokeWidth={2.4} />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top">{bookingTypeLabel}</TooltipContent>
                </Tooltip>
              )}
              {source && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      className={cn(
                        "inline-flex size-5 items-center justify-center rounded-md",
                        source.tone,
                      )}
                      aria-label={t(source.labelKey)}
                    >
                      <HugeiconsIcon icon={source.icon} size={12} strokeWidth={2.4} />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top">{t(source.labelKey)}</TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>
        )
      },
    },
    {
      id: "client",
      header: t("bookings.col.header.client"),
      cell: ({ row }) => {
        const p = row.original.client
        if (!p) return <span className="text-muted-foreground">—</span>
        const name = `${p.firstName} ${p.lastName}`
        const grad = getGradient(name)
        return (
          <button
            className="flex items-center gap-2.5 text-start hover:opacity-80 transition-opacity"
            onClick={() => onRowClick(row.original)}
          >
            <Avatar className="size-8">
              <AvatarFallback className={cn("bg-gradient-to-br text-primary-foreground text-[11px] font-semibold", grad)}>
                {getInitials(p.firstName, p.lastName)}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-semibold text-foreground">{name}</p>
              <p className="text-[11px] font-numeric text-muted-foreground" dir="ltr">
                {p.phone ?? "—"}
              </p>
            </div>
          </button>
        )
      },
    },
    {
      id: "employee",
      header: t("bookings.col.header.employee"),
      cell: ({ row }) => {
        const u = row.original.employee?.user
        const clinic = row.original.categoryNameSnapshot
        if (!u && !clinic) return <span className="text-muted-foreground">—</span>
        return (
          <div className="flex flex-col gap-0.5">
            {u ? (
              <span className="text-sm font-medium text-foreground">
                {t("bookings.info.drPrefix")} {u.firstName} {u.lastName}
              </span>
            ) : (
              <span className="text-sm text-muted-foreground">—</span>
            )}
            {clinic && <span className="text-[11px] text-muted-foreground">{clinic}</span>}
          </div>
        )
      },
    },
    {
      id: "datetime",
      accessorFn: (row) => new Date(`${row.date}T${row.startTime || "00:00"}`).getTime(),
      header: t("bookings.col.header.datetime"),
      cell: ({ row }) => {
        const mins = row.original.durationMinutesSnapshot
        return (
          <div className="font-numeric">
            <p className="text-sm font-medium text-foreground">
              {formatClinicDate(row.original.date, dateFormat)}
            </p>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">{formatClinicTime(row.original.startTime)}</span>
              {mins != null && (
                <span className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                  {mins} {t("bookings.minutesAbbrev")}
                </span>
              )}
            </div>
          </div>
        )
      },
    },
    {
      id: "amount",
      header: t("bookings.col.header.amount"),
      cell: ({ row }) => {
        const payment = row.original.payment
        const amount = (row.original.isHistoricalImport ? row.original.historicalPayment?.amount : undefined)
          ?? payment?.totalAmount
          ?? row.original.priceSnapshot
          ?? row.original.service?.price
          ?? null
        if (amount == null) return <span className="text-muted-foreground">—</span>
        return <FormattedCurrency amount={amount} locale={locale} decimals={2} className="font-numeric text-sm font-medium text-foreground" />
      },
    },
    {
      id: "paymentStatus",
      header: t("bookings.col.header.paymentStatus"),
      meta: { sizing: "compact", className: "w-px" },
      cell: ({ row }) => <PaymentStatusCell booking={row.original} />,
    },
    {
      accessorKey: "status",
      header: t("bookings.col.header.status"),
      meta: { sizing: "compact", className: "w-px" },
      cell: ({ row }) => (
        <StatusCell booking={row.original} onStatusAction={onStatusAction} onDelete={onDelete} />
      ),
    },
    {
      id: "actions",
      header: t("bookings.col.header.actions"),
      meta: { sizing: "compact", className: "w-px" },
      cell: ({ row }) => (
        <ActionsCell
          booking={row.original}
          onView={() => onRowClick(row.original)}
          onDelete={() => onDelete(row.original)}
          t={t}
        />
      ),
    },
  ]
}
