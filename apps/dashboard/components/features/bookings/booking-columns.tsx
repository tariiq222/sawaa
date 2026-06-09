"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { HugeiconsIcon } from "@hugeicons/react"
import { Globe02Icon, Store01Icon } from "@hugeicons/core-free-icons"
import { Avatar, AvatarFallback } from "@sawaa/ui"
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

/* Type dots — colored disc with a soft halo so the column reads at a glance.
   The dot is a real color (not an opacity wash) and the halo extends the hue. */
const typeDotConfig: Record<string, string> = {
  in_person: "bg-primary shadow-[0_0_0_3px_rgba(85,204,176,0.18)]",
  online:    "bg-info shadow-[0_0_0_3px_rgba(3,105,161,0.18)]",
  walk_in:   "bg-success shadow-[0_0_0_3px_rgba(21,128,61,0.18)]",
}

const typeLabelKey: Record<string, string> = {
  in_person: "bookings.col.type.inPerson",
  online: "bookings.col.type.online",
  walk_in: "bookings.col.type.walkIn",
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
  onRowClick: (booking: Booking) => void,
  onEditClick: (booking: Booking) => void,
  onStatusAction: (booking: Booking, action: QuickStatusActionType) => void,
  onDelete: (booking: Booking) => void,
  t: (key: string) => string,
  config?: { dateFormat?: DateFormat; locale?: "ar" | "en" },
): ColumnDef<Booking>[] {
  const dateFormat = config?.dateFormat ?? "Y-m-d"
  const locale = config?.locale ?? "ar"
  return [
    {
      accessorKey: "id",
      header: "#",
      cell: ({ row }) => {
        const source = sourceIconConfig[row.original.source]
        return (
          <div className="flex items-center gap-1.5">
            <span className="text-[13px] font-medium font-numeric text-muted-foreground">
              #{row.original.bookingNumber.toString().padStart(4, "0")}
            </span>
            {source && (
              <span
                className={cn(
                  "inline-flex size-5 items-center justify-center rounded-md",
                  source.tone,
                )}
                title={t(source.labelKey)}
                aria-label={t(source.labelKey)}
              >
                <HugeiconsIcon icon={source.icon} size={12} strokeWidth={2.4} />
              </span>
            )}
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
              <p className="text-[11px] font-numeric text-muted-foreground">
                #{row.original.bookingNumber.toString().padStart(4, "0")}
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
        if (!u) return <span className="text-muted-foreground">—</span>
        return (
          <span className="text-sm font-medium text-foreground">
            {t("bookings.info.drPrefix")} {u.firstName} {u.lastName}
          </span>
        )
      },
    },
    {
      accessorKey: "type",
      header: t("bookings.col.header.type"),
      cell: ({ row }) => {
        const type = row.original.type
        const dot = typeDotConfig[type] ?? "bg-muted-foreground"
        const labelKey = typeLabelKey[type]
        const label = labelKey ? t(labelKey) : type
        return (
          <div className="flex items-center gap-2.5">
            <span className={cn("size-2.5 shrink-0 rounded-full", dot)} />
            <span className="text-[13px] font-semibold text-foreground">{label}</span>
          </div>
        )
      },
    },
    {
      id: "datetime",
      header: t("bookings.col.header.datetime"),
      cell: ({ row }) => (
        <div className="font-numeric">
          <p className="text-sm font-medium text-foreground">
            {formatClinicDate(row.original.date, dateFormat)}
          </p>
          <p className="text-xs text-muted-foreground">{formatClinicTime(row.original.startTime)}</p>
        </div>
      ),
    },
    {
      id: "amount",
      header: t("bookings.col.header.amount"),
      cell: ({ row }) => {
        const payment = row.original.payment
        const amount = payment?.totalAmount ?? row.original.priceSnapshot ?? row.original.service?.price ?? null
        if (amount == null) return <span className="text-muted-foreground">—</span>
        return <FormattedCurrency amount={amount} locale={locale} decimals={2} className="font-numeric text-sm font-medium text-foreground" />
      },
    },
    {
      id: "paymentStatus",
      header: t("bookings.col.header.paymentStatus"),
      cell: ({ row }) => <PaymentStatusCell booking={row.original} />,
    },
    {
      accessorKey: "status",
      header: t("bookings.col.header.status"),
      cell: ({ row }) => (
        <StatusCell booking={row.original} onStatusAction={onStatusAction} onDelete={onDelete} />
      ),
    },
    {
      id: "actions",
      header: t("bookings.col.header.actions"),
      cell: ({ row }) => (
        <ActionsCell
          booking={row.original}
          onView={() => onRowClick(row.original)}
          onEdit={() => onEditClick(row.original)}
          onDelete={() => onDelete(row.original)}
          t={t}
        />
      ),
    },
  ]
}
