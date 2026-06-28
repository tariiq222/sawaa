"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import {
  Tick01Icon,
  ViewIcon,
  Delete02Icon,
  CheckmarkCircle02Icon,
  CheckmarkCircle01Icon,
  CancelCircleIcon,
  Cancel01Icon,
  UserCheck01Icon,
  EyeIcon,
  Invoice01Icon,
  Calendar03Icon,
  ArrowTurnBackwardIcon,
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
import { StatusBadge, PaymentStatusBadge } from "@/components/features/status-badge"
import { useLocale } from "@/components/locale-provider"
import { useAuth } from "@/components/providers/auth-provider"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { usePaymentMutations } from "@/hooks/use-payments"
import { ApiError } from "@/lib/api"
import { generateInvoicePdf } from "@/lib/api/invoices"
import { RecordPaymentDialog } from "@/components/features/bookings/record-payment-dialog"
import { BookingRefundDialog } from "@/components/features/bookings/booking-refund-dialog"
import type { Booking } from "@/lib/types/booking"

export type QuickStatusActionType = "confirm" | "checkin" | "complete" | "noshow" | "reschedule"

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

const rescheduleAction: QuickStatusAction = {
  action: "reschedule",
  labelKey: "bookings.col.edit",
  icon: Calendar03Icon,
}

/* Quick status actions available per status */
const quickStatusActions: Record<string, QuickStatusAction[]> = {
  pending:            [confirmAction, rescheduleAction],
  pending_group_fill: [confirmAction],
  awaiting_payment:   [confirmAction],
  confirmed: [
    { action: "checkin",  labelKey: "bookings.actions.action.checkin",  icon: UserCheck01Icon },
    { action: "complete", labelKey: "bookings.actions.action.complete", icon: CheckmarkCircle01Icon },
    { action: "noshow",   labelKey: "bookings.actions.action.noshow",   icon: EyeIcon, destructive: true },
    rescheduleAction,
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
/* ── Actions cell — delete opens the parent's AdminCancelDialog directly ──
   Icon buttons are colorized by intent so the user can tell at a glance which
   action is which, even before hovering. Neutrals stay for read/edit (view,
   edit, invoice) — those are non-destructive and don't need a hue. */
const intentIconBtn: Record<string, string> = {
  neutral: "flex size-9 items-center justify-center rounded-md border border-transparent text-muted-foreground transition-all duration-200 hover:bg-primary-ultra-light hover:border-primary/30 hover:text-primary",
  approve: "flex size-9 items-center justify-center rounded-md border border-transparent text-success transition-all duration-200 bg-success-soft hover:bg-success hover:text-white hover:border-success",
  reject:  "flex size-9 items-center justify-center rounded-md border border-transparent text-error transition-all duration-200 bg-error-soft hover:bg-error hover:text-white hover:border-error",
  danger:  "flex size-9 items-center justify-center rounded-md border border-transparent text-muted-foreground transition-all duration-200 hover:bg-error-soft hover:border-error/40 hover:text-error",
}

export function ActionsCell({
  booking,
  onView,
  onDelete,
  t,
}: {
  booking: Booking
  onView: () => void
  onDelete: () => void
  t: (key: string) => string
}) {
  const queryClient = useQueryClient()
  const { canDo } = useAuth()
  const { verifyMut } = usePaymentMutations()
  const [invoiceLoading, setInvoiceLoading] = useState(false)
  const [refundOpen, setRefundOpen] = useState(false)

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
  const canVerify = payment?.status === "awaiting"
  const isPending = verifyMut.isPending
  // Terminal bookings are over: no editing. Invoice stays reachable for review.
  const hasInvoice = !!booking.invoice
  // Off-gateway refund: only cash/bank-transfer/mada/tabby payments (no Moyasar
  // card gateway). Card refunds go through the admin-only gateway path.
  // Backend gate: PATCH /payments/:id/manual-refund requires `update:Payment`.
  const canManualRefund =
    !!payment &&
    payment.status === "paid" &&
    payment.method !== "moyasar" &&
    canDo("payment", "update")

  const invalidateBookings = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.bookings.all })

  return (
    <div className="flex items-center gap-1">
      {canVerify && payment && (
        <>
          <button
            className={intentIconBtn.approve}
            aria-label={t("bookings.payment.action.approveTransfer")}
            disabled={isPending}
            onClick={() => verifyMut.mutate({ id: payment.id, action: "approve" }, { onSuccess: invalidateBookings })}
          >
            <HugeiconsIcon icon={CheckmarkCircle02Icon} size={16} strokeWidth={2.2} />
          </button>
          <button
            className={intentIconBtn.reject}
            aria-label={t("bookings.payment.action.rejectTransfer")}
            disabled={isPending}
            onClick={() => verifyMut.mutate({ id: payment.id, action: "reject" }, { onSuccess: invalidateBookings })}
          >
            <HugeiconsIcon icon={CancelCircleIcon} size={16} strokeWidth={2.2} />
          </button>
        </>
      )}
      <button className={intentIconBtn.neutral} aria-label={t("bookings.col.view")} onClick={onView}>
        <HugeiconsIcon icon={ViewIcon} size={16} strokeWidth={2.2} />
      </button>
      {hasInvoice && (
        <button
          className={intentIconBtn.neutral}
          aria-label={t("bookings.col.invoice")}
          disabled={invoiceLoading}
          onClick={handleInvoicePdf}
        >
          <HugeiconsIcon icon={Invoice01Icon} size={16} strokeWidth={2.2} />
        </button>
      )}
      {canManualRefund && payment && (
        <>
          <button
            className={intentIconBtn.neutral}
            aria-label={t("refund.title")}
            onClick={() => setRefundOpen(true)}
          >
            <HugeiconsIcon icon={ArrowTurnBackwardIcon} size={16} strokeWidth={2.2} />
          </button>
          <BookingRefundDialog
            paymentId={payment.id}
            maxAmount={payment.amount}
            open={refundOpen}
            onOpenChange={setRefundOpen}
          />
        </>
      )}
      <button
        className={intentIconBtn.danger}
        aria-label={t("bookings.col.delete")}
        onClick={onDelete}
      >
        <HugeiconsIcon icon={Delete02Icon} size={16} strokeWidth={2.2} />
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

/** A "paid" payment with an invoice that still has an outstanding balance is a deposit/partial. */
export function isPartiallyPaid(booking: Booking): boolean {
  return booking.payment?.status === "paid" && (booking.invoice?.outstanding ?? 0) > 0
}

export function PaymentStatusCell({ booking }: { booking: Booking }) {
  const { t } = useLocale()
  const { canDo } = useAuth()
  const payment = booking.payment
  const hasOutstanding = (booking.invoice?.outstanding ?? 0) > 0
  // Pay-at-clinic bookings have no invoice yet — still allow recording a payment
  // (the dialog materialises a DRAFT invoice on open). Needs a price and a client
  // (the backend cannot invoice a guest booking without one).
  const bookingPrice = booking.priceSnapshot ?? booking.service?.price ?? 0
  const noInvoiceButPayable = !booking.invoice && bookingPrice > 0 && !!booking.clientId
  // Backend gate: POST /dashboard/finance/payments requires `manage:Payment`
  // (and manage:Invoice for the DRAFT-invoice sub-call).
  const canRecordPayment =
    (hasOutstanding || noInvoiceButPayable) &&
    payment?.status !== "awaiting" &&
    canDo("payment", "manage")

  const [recordOpen, setRecordOpen] = useState(false)

  const status = isPartiallyPaid(booking) ? "partial" : payment?.status ?? "unpaid"
  const label = payment
    ? t("bookings.col.paymentStatus." + status)
    : t("bookings.col.paymentStatus.unpaid")

  if (canRecordPayment) {
    return (
      <>
        <button
          type="button"
          onClick={() => setRecordOpen(true)}
          aria-label={t("bookings.col.recordPayment")}
          className="rounded-md transition-opacity hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 cursor-pointer"
        >
          <PaymentStatusBadge status={status} label={label} />
        </button>
        <RecordPaymentDialog booking={booking} open={recordOpen} onOpenChange={setRecordOpen} />
      </>
    )
  }

  return <PaymentStatusBadge status={status} label={label} />
}
