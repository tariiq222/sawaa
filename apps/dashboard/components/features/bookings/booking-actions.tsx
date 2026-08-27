"use client"

// EXCEPTION: file exceeded the 300-line feature-component soft limit with the
// addition of the no-show restore dialog (mutation wiring + state + render
// alongside the existing cancel dialogs). Kept in one file because the
// dropdown's `handleAction` switch is the single dispatch point for every
// status-driven action, and splitting it would force callers to import two
// BookingActions components. Stay ≤350 (absolute limit). Added 2026-08-27 for
// T3-dashboard-restore-noshow.

import { useState } from "react"
import { toast } from "sonner"
import { useLocale } from "@/components/locale-provider"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Settings02Icon,
  Tick01Icon,
  UserCheck01Icon,
  Cancel01Icon,
  CheckmarkCircle01Icon,
  EyeIcon,
  ArrowTurnBackwardIcon,
} from "@hugeicons/core-free-icons"
import { Button } from "@sawaa/ui"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@sawaa/ui"
import { useBookingMutations } from "@/hooks/use-bookings"
import { useAuth } from "@/components/providers/auth-provider"
import { showApiError } from "@/lib/mutation-helpers"
import { sarToHalalas } from "@/lib/money"
import type { Booking, CancellationReason, RefundDecision, RefundType } from "@/lib/types/booking"
import { ApproveCancelDialog, RejectCancelDialog, AdminCancelDialog } from "./cancel-dialogs"
import { RestoreNoShowDialog } from "./restore-no-show-dialog"
import { CollectAction, canCollectBooking, useLatestBookingRef } from "./booking-collect-action"

interface BookingActionsProps {
  booking: Booking
  onAction: () => void
}

/* ── Transition map: status → available actions ──
 * Aligned with DB BookingStatus. `pending_group_fill` and
 * `awaiting_payment` reuse the `pending` action set since the dashboard
 * collapses them to `pending` for display via mapStatusForUi.
 */
const statusActions = {
  pending: ["confirm", "cancel"] as const,
  pending_group_fill: ["confirm", "cancel"] as const,
  awaiting_payment: ["confirm", "cancel"] as const,
  deposit_paid: ["confirm", "cancel"] as const,
  confirmed: ["checkin", "complete", "noshow", "cancel"] as const,
  cancel_requested: ["approve_cancel", "reject_cancel"] as const,
  completed: [] as const,
  cancelled: [] as const,
  no_show: ["restore_noshow"] as const,
  expired: [] as const,
}

const getActionMeta = (t: (k: string) => string) => ({
  confirm:        { label: t("bookings.actions.action.confirm"),       icon: Tick01Icon,            variant: "default" },
  checkin:        { label: t("bookings.actions.action.checkin"),       icon: UserCheck01Icon,       variant: "outline" },
  complete:       { label: t("bookings.actions.action.complete"),      icon: CheckmarkCircle01Icon, variant: "default" },
  noshow:         { label: t("bookings.actions.action.noshow"),        icon: EyeIcon,               variant: "destructive" },
  cancel:         { label: t("bookings.actions.action.cancel"),        icon: Cancel01Icon,          variant: "destructive" },
  approve_cancel: { label: t("bookings.actions.action.approveCancel"), icon: Tick01Icon,            variant: "default" },
  reject_cancel:  { label: t("bookings.actions.action.rejectCancel"),  icon: Cancel01Icon,          variant: "outline" },
  restore_noshow: { label: t("bookings.actions.action.restoreNoShow"), icon: ArrowTurnBackwardIcon, variant: "outline" },
})

const getStatusLabels = (t: (k: string) => string): Record<string, string> => ({
  pending:              t("bookings.actions.status.pending"),
  pending_group_fill:   t("bookings.actions.status.pending_group_fill"),
  awaiting_payment:     t("bookings.actions.status.awaiting_payment"),
  confirmed:            t("bookings.actions.status.confirmed"),
  completed:            t("bookings.actions.status.completed"),
  cancelled:            t("bookings.actions.status.cancelled"),
  cancel_requested:     t("bookings.actions.status.cancel_requested"),
  no_show:              t("bookings.actions.status.no_show"),
  expired:              t("bookings.actions.status.expired"),
})

export function BookingActions({ booking, onAction }: BookingActionsProps) {
  const { t } = useLocale()
  const { canDo } = useAuth()
  const actionMeta = getActionMeta(t)
  const statusLabels = getStatusLabels(t)
  const {
    confirmMut,
    checkInMut,
    completeMut,
    noShowMut,
    restoreNoShowMut,
    adminCancelMut,
    approveCancelMut,
    rejectCancelMut,
  } = useBookingMutations()

  const [cancelDialog, setCancelDialog] = useState<"approve" | "reject" | "admin" | null>(null)
  const [refundType, setRefundType] = useState<RefundType>("full")
  const [refundAmount, setRefundAmount] = useState("")
  const [adminNotes, setAdminNotes] = useState("")
  const [cancelReason, setCancelReason] = useState<CancellationReason | "">("")
  const [collectOpen, setCollectOpen] = useState(false)
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false)
  const [restoreReason, setRestoreReason] = useState("")

  const loading =
    confirmMut.isPending ||
    checkInMut.isPending ||
    completeMut.isPending ||
    noShowMut.isPending ||
    restoreNoShowMut.isPending ||
    adminCancelMut.isPending ||
    approveCancelMut.isPending ||
    rejectCancelMut.isPending

  // Always resolves; returns true on success, false on caught failure so
  // callers can gate follow-up UI. Toast + onAction() behavior unchanged.
  const run = async (action: () => Promise<unknown>, msg: string): Promise<boolean> => {
    try {
      await action()
      toast.success(msg)
      onAction()
      return true
    } catch (err) {
      showApiError(err, { fallback: t("bookings.actions.toast.genericError"), t })
      return false
    }
  }

  const resetDialog = () => {
    setCancelDialog(null)
    setRefundType("full")
    setRefundAmount("")
    setAdminNotes("")
    setCancelReason("")
  }

  const resetRestoreDialog = () => {
    setRestoreDialogOpen(false)
    setRestoreReason("")
  }

  const { status } = booking
  const actions = statusActions[status] ?? []

  // "Owes money" predicate — co-located in booking-collect-action.tsx so the
  // dropdown item and the dialog render with the same gating.
  const canCollect = canCollectBooking(booking, canDo)

  // Latest-prop ref: re-evaluate canCollect against the parent's current
  // booking inside the post-complete `.then()` (onAction() refreshes first).
  const bookingRef = useLatestBookingRef(booking)

  const handleAction = (action: string) => {
    switch (action) {
      case "confirm":
        run(() => confirmMut.mutateAsync(booking.id), t("bookings.actions.toast.confirmed"))
        break
      case "checkin":
        run(() => checkInMut.mutateAsync(booking.id), t("bookings.actions.toast.checkedIn"))
        break
      case "complete":
        // Successful complete on a still-owing booking opens collect dialog.
        // Gated on `run`'s boolean so a FAILED complete never opens it.
        run(() => completeMut.mutateAsync(booking.id), t("bookings.actions.toast.completed"))
          .then((ok) => {
            if (ok && canCollectBooking(bookingRef.current, canDo)) {
              setCollectOpen(true)
            }
          })
        break
      case "noshow":
        run(() => noShowMut.mutateAsync(booking.id), t("bookings.actions.toast.noShow"))
        break
      case "cancel":
        setCancelDialog("admin")
        break
      case "approve_cancel":
        if (booking.suggestedRefundType) setRefundType(booking.suggestedRefundType)
        setCancelDialog("approve")
        break
      case "reject_cancel":
        setCancelDialog("reject")
        break
      case "restore_noshow":
        // Open the dialog so the staff member can write a reason. The mutation
        // is fired only after they confirm (preserves the `run` wrapper's
        // toast + onAction() behaviour for the success path).
        setRestoreDialogOpen(true)
        break
    }
  }

  if (booking.isHistoricalImport || (actions.length === 0 && !canCollect)) return null

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline" disabled={loading} className="gap-1.5">
            <HugeiconsIcon icon={Settings02Icon} size={14} />
            {t("bookings.actions.trigger")}
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" side="bottom" className="w-48">
          <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
            {t("bookings.actions.currentStatus")}{" "}
            <span className="font-semibold text-foreground">
              {statusLabels[status] ?? status}
            </span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />

          {actions.map((action) => {
            const meta = actionMeta[action]
            const isDestructive = meta.variant === "destructive"
            return (
              <DropdownMenuItem
                key={action}
                onClick={() => handleAction(action)}
                className={isDestructive ? "text-destructive focus:text-destructive focus:bg-destructive/10" : ""}
              >
                <HugeiconsIcon icon={meta.icon} size={15} className="shrink-0" />
                {meta.label}
              </DropdownMenuItem>
            )
          })}
          {canCollect && actions.length > 0 && <DropdownMenuSeparator />}
          {canCollect && (
            <CollectAction
              booking={booking}
              open={collectOpen}
              setOpen={setCollectOpen}
              onCollected={onAction}
            />
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <ApproveCancelDialog
        open={cancelDialog === "approve"}
        suggestedRefundType={booking.suggestedRefundType}
        refundType={refundType}
        setRefundType={setRefundType}
        refundAmount={refundAmount}
        setRefundAmount={setRefundAmount}
        adminNotes={adminNotes}
        setAdminNotes={setAdminNotes}
        loading={loading}
        onReset={resetDialog}
        onApprove={async () => {
          if (refundType === "partial" && (!refundAmount || Number(refundAmount) < 1)) {
            toast.error(t("bookings.actions.validation.refundAmountRequired"))
            return
          }
          await run(
            () => approveCancelMut.mutateAsync({
              id: booking.id,
              approverNotes: adminNotes || undefined,
              refundType: refundType.toUpperCase() as RefundDecision,
              refundAmount: refundType === "partial" ? sarToHalalas(Number(refundAmount)) : undefined,
            }),
            t("bookings.actions.toast.cancelled"),
          )
          resetDialog()
        }}
      />

      <RejectCancelDialog
        open={cancelDialog === "reject"}
        adminNotes={adminNotes}
        setAdminNotes={setAdminNotes}
        loading={loading}
        onReset={resetDialog}
        onReject={async () => {
          if (!adminNotes || adminNotes.trim().length < 1) {
            toast.error(t("bookings.actions.validation.reasonRequired"))
            return
          }
          await run(
            () => rejectCancelMut.mutateAsync({
              id: booking.id,
              rejectReason: adminNotes,
            }),
            t("bookings.actions.toast.confirmed"),
          )
          resetDialog()
        }}
      />

      <AdminCancelDialog
        open={cancelDialog === "admin"}
        cancelReason={cancelReason as CancellationReason | ""}
        setCancelReason={setCancelReason}
        adminNotes={adminNotes}
        setAdminNotes={setAdminNotes}
        loading={loading}
        onReset={resetDialog}
        onCancel={async () => {
          if (!cancelReason) {
            toast.error(t("bookings.actions.validation.reasonRequired"))
            return
          }
          await run(
            () => adminCancelMut.mutateAsync({
              id: booking.id,
              reason: cancelReason as CancellationReason,
              cancelNotes: adminNotes || undefined,
            }),
            t("bookings.actions.toast.cancelled"),
          )
          resetDialog()
        }}
      />

      <RestoreNoShowDialog
        open={restoreDialogOpen}
        reason={restoreReason}
        setReason={setRestoreReason}
        loading={loading}
        onReset={resetRestoreDialog}
        onConfirm={async () => {
          const trimmed = restoreReason.trim()
          if (trimmed.length < 3) {
            toast.error(t("bookings.actions.validation.reasonRequired"))
            return
          }
          await run(
            () => restoreNoShowMut.mutateAsync({
              id: booking.id,
              reason: trimmed,
            }),
            t("bookings.actions.toast.restoredFromNoShow"),
          )
          resetRestoreDialog()
        }}
      />
    </>
  )
}
