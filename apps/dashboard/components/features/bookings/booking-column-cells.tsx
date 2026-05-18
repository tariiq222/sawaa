"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import {
  Tick01Icon,
  ViewIcon,
  PencilEdit01Icon,
  Delete02Icon,
  CheckmarkCircle02Icon,
  CancelCircleIcon,
  ArrowReloadHorizontalIcon,
  MoreVerticalIcon,
} from "@hugeicons/core-free-icons"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@sawaa/ui"
import { StatusBadge } from "@/components/features/status-badge"
import { useLocale } from "@/components/locale-provider"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { usePaymentMutations } from "@/hooks/use-payments"
import { cn } from "@/lib/utils"
import type { Booking, BookingPayment } from "@/lib/types/booking"

type QuickStatusAction = {
  action: "confirm" | "noshow"
  labelKey: string
  icon: typeof Tick01Icon
  destructive?: boolean
}

/* Quick status actions available per status */
const quickStatusActions: Record<string, QuickStatusAction[]> = {
  pending:   [{ action: "confirm", labelKey: "bookings.col.quickAction.confirm", icon: Tick01Icon }],
  confirmed: [],
}

/* ── Actions cell — delete opens the parent's AdminCancelDialog directly ── */
export function ActionsCell({
  booking: _booking,
  onView,
  onEdit,
  onDelete,
  t,
}: {
  booking: Booking
  onView: () => void
  onEdit: () => void
  onDelete: () => void
  t: (key: string) => string
}) {
  const viewBtn = "flex size-9 items-center justify-center rounded-sm border border-transparent text-muted-foreground transition-all duration-200 hover:bg-muted hover:border-border hover:text-foreground"

  return (
    <div className="flex items-center gap-1">
      <button className={viewBtn} aria-label={t("bookings.col.view")} onClick={onView}>
        <HugeiconsIcon icon={ViewIcon} size={16} />
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className={cn(viewBtn, "text-muted-foreground")}
            aria-label={t("bookings.col.actions")}
          >
            <HugeiconsIcon icon={MoreVerticalIcon} size={16} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-44">
          <DropdownMenuItem onSelect={onEdit}>
            <HugeiconsIcon icon={PencilEdit01Icon} size={15} className="me-2 shrink-0" />
            {t("bookings.col.edit")}
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={onDelete}
            className="text-destructive focus:text-destructive focus:bg-destructive/10"
          >
            <HugeiconsIcon icon={Delete02Icon} size={15} className="me-2 shrink-0" />
            {t("bookings.col.delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

/* ── Status cell with quick-action dropdown ── */
export function StatusCell({
  booking,
  onStatusAction,
}: {
  booking: Booking
  onStatusAction: (booking: Booking, action: "confirm" | "noshow") => void
}) {
  const { t } = useLocale()
  const actions = quickStatusActions[booking.status]
  if (!actions?.length) return <StatusBadge status={booking.status} />

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="rounded-md transition-opacity hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
          <StatusBadge status={booking.status} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-44">
        {actions.map(({ action, labelKey, icon, destructive }) => (
          <DropdownMenuItem
            key={action}
            onSelect={() => onStatusAction(booking, action)}
            className={destructive ? "text-destructive focus:text-destructive focus:bg-destructive/10" : ""}
          >
            <HugeiconsIcon icon={icon} size={15} className="me-2 shrink-0" />
            {t(labelKey)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/* ── Payment status cell ── */
const paymentStatusStyles: Record<string, string> = {
  pending:  "border-warning/30 bg-warning/10 text-warning",
  awaiting: "border-warning/30 bg-warning/10 text-warning",
  paid:     "border-success/30 bg-success/10 text-success",
  refunded: "border-info/30 bg-info/10 text-info",
  failed:   "border-destructive/30 bg-destructive/10 text-destructive",
  rejected: "border-destructive/30 bg-destructive/10 text-destructive",
}

/** Statuses that have no actions — render as plain badge, no dropdown */
const NON_INTERACTIVE_STATUSES = new Set(["pending", "failed", "refunded", "rejected"])

export function PaymentStatusCell({ payment }: { payment: BookingPayment | null }) {
  const { t } = useLocale()
  const queryClient = useQueryClient()
  const { verifyMut, refundMut } = usePaymentMutations()

  if (!payment) return <span className="text-muted-foreground">—</span>

  const pillClass = cn(
    "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
    paymentStatusStyles[payment.status] ?? "",
  )
  const label = t("bookings.col.paymentStatus." + payment.status)

  const invalidateBookings = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.bookings.all })

  // Statuses with no actions → plain non-interactive span
  if (NON_INTERACTIVE_STATUSES.has(payment.status)) {
    return <span className={pillClass}>{label}</span>
  }

  const isPending = verifyMut.isPending || refundMut.isPending

  // awaiting → approve + reject
  if (payment.status === "awaiting") {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="rounded-md transition-opacity hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            disabled={isPending}
          >
            <span className={pillClass}>{label}</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          <DropdownMenuItem
            onSelect={() => {
              verifyMut.mutate(
                { id: payment.id, action: "approve" },
                { onSuccess: invalidateBookings },
              )
            }}
            disabled={isPending}
          >
            <HugeiconsIcon icon={CheckmarkCircle02Icon} size={15} className="me-2 shrink-0 text-success" />
            {t("bookings.payment.action.approveTransfer")}
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              verifyMut.mutate(
                { id: payment.id, action: "reject" },
                { onSuccess: invalidateBookings },
              )
            }}
            disabled={isPending}
            className="text-destructive focus:text-destructive focus:bg-destructive/10"
          >
            <HugeiconsIcon icon={CancelCircleIcon} size={15} className="me-2 shrink-0" />
            {t("bookings.payment.action.rejectTransfer")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  // paid → refund
  if (payment.status === "paid") {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="rounded-md transition-opacity hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            disabled={isPending}
          >
            <span className={pillClass}>{label}</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          <DropdownMenuItem
            onSelect={() => {
              refundMut.mutate(
                { id: payment.id, reason: t("bookings.payment.refundReason") },
                { onSuccess: invalidateBookings },
              )
            }}
            disabled={isPending}
            className="text-destructive focus:text-destructive focus:bg-destructive/10"
          >
            <HugeiconsIcon icon={ArrowReloadHorizontalIcon} size={15} className="me-2 shrink-0" />
            {t("bookings.payment.action.refund")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  // Fallback: plain badge for any unhandled status
  return <span className={pillClass}>{label}</span>
}
