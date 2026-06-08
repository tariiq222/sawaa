"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import {
  Tick01Icon,
  ViewIcon,
  PencilEdit01Icon,
  Delete02Icon,
  CheckmarkCircle02Icon,
  CheckmarkCircle01Icon,
  CancelCircleIcon,
  Cancel01Icon,
  UserCheck01Icon,
  EyeIcon,
  ArrowReloadHorizontalIcon,
  MoneyAdd01Icon,
  Invoice01Icon,
} from "@hugeicons/core-free-icons"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@sawaa/ui"
import { useState } from "react"
import { toast } from "sonner"
import { StatusBadge } from "@/components/features/status-badge"
import { useLocale } from "@/components/locale-provider"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { usePaymentMutations } from "@/hooks/use-payments"
import { ApiError } from "@/lib/api"
import { generateInvoicePdf } from "@/lib/api/invoices"
import { cn } from "@/lib/utils"
import { RecordPaymentDialog } from "@/components/features/bookings/record-payment-dialog"
import type { Booking } from "@/lib/types/booking"

export type QuickStatusActionType = "confirm" | "checkin" | "complete" | "noshow"

type QuickStatusAction = {
  action: QuickStatusActionType
  labelKey: string
  icon: typeof Tick01Icon
  destructive?: boolean
}

const confirmAction: QuickStatusAction = {
  action: "confirm",
  labelKey: "bookings.col.quickAction.confirm",
  icon: Tick01Icon,
}

/* Quick status actions available per status */
const quickStatusActions: Record<string, QuickStatusAction[]> = {
  pending:            [confirmAction],
  pending_group_fill: [confirmAction],
  awaiting_payment:   [confirmAction],
  confirmed: [
    { action: "checkin",  labelKey: "bookings.actions.action.checkin",  icon: UserCheck01Icon },
    { action: "complete", labelKey: "bookings.actions.action.complete", icon: CheckmarkCircle01Icon },
    { action: "noshow",   labelKey: "bookings.actions.action.noshow",   icon: EyeIcon, destructive: true },
  ],
}

/* Statuses that can still be cancelled from the quick menu */
const CANCELLABLE_STATUSES = new Set([
  "pending",
  "pending_group_fill",
  "awaiting_payment",
  "confirmed",
  "cancel_requested",
])

/* Terminal statuses — the booking is over, so it can no longer be edited */
const TERMINAL_STATUSES = new Set([
  "completed",
  "cancelled",
  "no_show",
  "expired",
])

/* ── Actions cell — delete opens the parent's AdminCancelDialog directly ── */
export function ActionsCell({
  booking,
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
  const iconBtn = "flex size-9 items-center justify-center rounded-sm border border-transparent text-muted-foreground transition-all duration-200 hover:bg-muted hover:border-border hover:text-foreground"
  const queryClient = useQueryClient()
  const { verifyMut, refundMut } = usePaymentMutations()
  const [recordOpen, setRecordOpen] = useState(false)
  const [invoiceLoading, setInvoiceLoading] = useState(false)

  // Generate (or reuse) the invoice PDF and open it in a new tab — works for any status.
  const handleInvoicePdf = async () => {
    if (!booking.invoice) return
    setInvoiceLoading(true)
    const toastId = toast.loading(t("invoices.generatingPdf"))
    try {
      const { url } = await generateInvoicePdf(booking.invoice.id)
      toast.dismiss(toastId)
      window.open(url, "_blank")
    } catch (err) {
      toast.dismiss(toastId)
      toast.error(
        err instanceof ApiError && err.status === 404
          ? t("invoices.noPdfYet")
          : t("invoices.downloadPdfError"),
      )
    } finally {
      setInvoiceLoading(false)
    }
  }

  const payment = booking.payment
  const hasOutstanding = (booking.invoice?.outstanding ?? 0) > 0
  // Record/collect while a balance remains — covers unpaid and deposit/partial follow-ups.
  const canRecordPayment = !!booking.invoice && hasOutstanding && payment?.status !== "awaiting"
  const canVerify = payment?.status === "awaiting"
  // Refund only once the invoice is settled in full; a partial still owes a balance.
  const canRefund = payment?.status === "paid" && !hasOutstanding
  const isPending = verifyMut.isPending || refundMut.isPending
  // Terminal bookings are over: no editing. Invoice stays reachable for review.
  const isTerminal = TERMINAL_STATUSES.has(booking.status)
  const hasInvoice = !!booking.invoice

  const invalidateBookings = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.bookings.all })

  return (
    <div className="flex items-center gap-1">
      {canRecordPayment && (
        <>
          <button
            className={cn(iconBtn, "hover:bg-success/10 hover:border-success/20 hover:text-success")}
            aria-label={t("bookings.col.recordPayment")}
            onClick={() => setRecordOpen(true)}
          >
            <HugeiconsIcon icon={MoneyAdd01Icon} size={16} />
          </button>
          <RecordPaymentDialog booking={booking} open={recordOpen} onOpenChange={setRecordOpen} />
        </>
      )}
      {canVerify && payment && (
        <>
          <button
            className={cn(iconBtn, "hover:bg-success/10 hover:border-success/20 hover:text-success")}
            aria-label={t("bookings.payment.action.approveTransfer")}
            disabled={isPending}
            onClick={() => verifyMut.mutate({ id: payment.id, action: "approve" }, { onSuccess: invalidateBookings })}
          >
            <HugeiconsIcon icon={CheckmarkCircle02Icon} size={16} />
          </button>
          <button
            className={cn(iconBtn, "hover:bg-destructive/10 hover:border-destructive/20 hover:text-destructive")}
            aria-label={t("bookings.payment.action.rejectTransfer")}
            disabled={isPending}
            onClick={() => verifyMut.mutate({ id: payment.id, action: "reject" }, { onSuccess: invalidateBookings })}
          >
            <HugeiconsIcon icon={CancelCircleIcon} size={16} />
          </button>
        </>
      )}
      {canRefund && payment && (
        <button
          className={cn(iconBtn, "hover:bg-destructive/10 hover:border-destructive/20 hover:text-destructive")}
          aria-label={t("bookings.payment.action.refund")}
          disabled={isPending}
          onClick={() => refundMut.mutate({ id: payment.id, reason: t("bookings.payment.refundReason") }, { onSuccess: invalidateBookings })}
        >
          <HugeiconsIcon icon={ArrowReloadHorizontalIcon} size={16} />
        </button>
      )}
      <button className={iconBtn} aria-label={t("bookings.col.view")} onClick={onView}>
        <HugeiconsIcon icon={ViewIcon} size={16} />
      </button>
      {hasInvoice && (
        <button
          className={iconBtn}
          aria-label={t("bookings.col.invoice")}
          disabled={invoiceLoading}
          onClick={handleInvoicePdf}
        >
          <HugeiconsIcon icon={Invoice01Icon} size={16} />
        </button>
      )}
      {!isTerminal && (
        <button className={iconBtn} aria-label={t("bookings.col.edit")} onClick={onEdit}>
          <HugeiconsIcon icon={PencilEdit01Icon} size={16} />
        </button>
      )}
      <button
        className={cn(iconBtn, "hover:bg-destructive/10 hover:border-destructive/20 hover:text-destructive")}
        aria-label={t("bookings.col.delete")}
        onClick={onDelete}
      >
        <HugeiconsIcon icon={Delete02Icon} size={16} />
      </button>
    </div>
  )
}

/* ── Status cell with quick-action dropdown ── */
export function StatusCell({
  booking,
  onStatusAction,
  onDelete,
}: {
  booking: Booking
  onStatusAction: (booking: Booking, action: QuickStatusActionType) => void
  onDelete: (booking: Booking) => void
}) {
  const { t } = useLocale()
  const actions = quickStatusActions[booking.status] ?? []
  const canCancel = CANCELLABLE_STATUSES.has(booking.status)
  if (!actions.length && !canCancel) return <StatusBadge status={booking.status} />

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
        {canCancel && (
          <>
            {actions.length > 0 && <DropdownMenuSeparator />}
            <DropdownMenuItem
              onSelect={() => onDelete(booking)}
              className="text-destructive focus:text-destructive focus:bg-destructive/10"
            >
              <HugeiconsIcon icon={Cancel01Icon} size={15} className="me-2 shrink-0" />
              {t("bookings.col.quickAction.cancel")}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/* ── Payment status cell ── */
const paymentStatusStyles: Record<string, string> = {
  pending:  "border-warning/30 bg-warning/10 text-warning",
  awaiting: "border-warning/30 bg-warning/10 text-warning",
  partial:  "border-warning/30 bg-warning/10 text-warning",
  paid:     "border-success/30 bg-success/10 text-success",
  refunded: "border-info/30 bg-info/10 text-info",
  failed:   "border-destructive/30 bg-destructive/10 text-destructive",
  rejected: "border-destructive/30 bg-destructive/10 text-destructive",
}

/** A "paid" payment with an invoice that still has an outstanding balance is a deposit/partial. */
export function isPartiallyPaid(booking: Booking): boolean {
  return booking.payment?.status === "paid" && (booking.invoice?.outstanding ?? 0) > 0
}

export function PaymentStatusCell({ booking }: { booking: Booking }) {
  const { t } = useLocale()
  const payment = booking.payment

  const status = isPartiallyPaid(booking) ? "partial" : payment?.status ?? "pending"
  const label = payment
    ? t("bookings.col.paymentStatus." + status)
    : t("bookings.col.paymentStatus.unpaid")

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        paymentStatusStyles[status] ?? "",
      )}
    >
      {label}
    </span>
  )
}
