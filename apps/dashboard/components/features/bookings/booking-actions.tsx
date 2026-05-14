"use client"

import { useState } from "react"
import { toast } from "sonner"
import { useLocale } from "@/components/locale-provider"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Settings02Icon,
  Tick01Icon,
  UserCheck01Icon,
  ComputerVideoCallIcon,
  Cancel01Icon,
  CheckmarkCircle01Icon,
  EyeIcon,
} from "@hugeicons/core-free-icons"
import { Button } from "@deqah/ui"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@deqah/ui"
import { useBookingMutations } from "@/hooks/use-bookings"
import type { Booking, RefundType } from "@/lib/types/booking"
import { ApproveCancelDialog, RejectCancelDialog, AdminCancelDialog } from "./cancel-dialogs"

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
  confirmed: ["complete", "noshow", "cancel"] as const,
  cancel_requested: ["approve_cancel", "reject_cancel"] as const,
  completed: [] as const,
  cancelled: [] as const,
  no_show: [] as const,
  expired: [] as const,
}

const getActionMeta = (t: (k: string) => string) => ({
  confirm:        { label: t("bookings.actions.action.confirm"),       icon: Tick01Icon,            variant: "default" },
  checkin:        { label: t("bookings.actions.action.checkin"),       icon: UserCheck01Icon,       variant: "outline" },
  start:          { label: t("bookings.actions.action.start"),         icon: ComputerVideoCallIcon, variant: "default" },
  complete:       { label: t("bookings.actions.action.complete"),      icon: CheckmarkCircle01Icon, variant: "default" },
  noshow:         { label: t("bookings.actions.action.noshow"),        icon: EyeIcon,               variant: "destructive" },
  cancel:         { label: t("bookings.actions.action.cancel"),        icon: Cancel01Icon,          variant: "destructive" },
  approve_cancel: { label: t("bookings.actions.action.approveCancel"), icon: Tick01Icon,            variant: "default" },
  reject_cancel:  { label: t("bookings.actions.action.rejectCancel"),  icon: Cancel01Icon,          variant: "outline" },
})

const getStatusLabels = (t: (k: string) => string): Record<string, string> => ({
  pending:              t("bookings.actions.status.pending"),
  pending_group_fill:   t("bookings.actions.status.pending"),
  awaiting_payment:     t("bookings.actions.status.pending"),
  confirmed:            t("bookings.actions.status.confirmed"),
  completed:            t("bookings.actions.status.completed"),
  cancelled:            t("bookings.actions.status.cancelled"),
  cancel_requested:     t("bookings.actions.status.cancel_requested"),
  no_show:              t("bookings.actions.status.noShow"),
  expired:              t("bookings.actions.status.expired"),
})

export function BookingActions({ booking, onAction }: BookingActionsProps) {
  const { t } = useLocale()
  const actionMeta = getActionMeta(t)
  const statusLabels = getStatusLabels(t)
  const {
    confirmMut,
    checkInMut,
    completeMut,
    noShowMut,
    adminCancelMut,
  } = useBookingMutations()

  const [cancelDialog, setCancelDialog] = useState<"approve" | "reject" | "admin" | null>(null)
  const [refundType, setRefundType] = useState<RefundType>("full")
  const [refundAmount, setRefundAmount] = useState("")
  const [adminNotes, setAdminNotes] = useState("")
  const [cancelReason, setCancelReason] = useState("")

  const loading =
    confirmMut.isPending ||
    checkInMut.isPending ||
    completeMut.isPending ||
    noShowMut.isPending ||
    adminCancelMut.isPending

  const run = async (action: () => Promise<unknown>, msg: string) => {
    try {
      await action()
      toast.success(msg)
      onAction()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("bookings.actions.toast.genericError"))
    }
  }

  const resetDialog = () => {
    setCancelDialog(null)
    setRefundType("full")
    setRefundAmount("")
    setAdminNotes("")
    setCancelReason("")
  }

  const { status } = booking
  const actions = statusActions[status] ?? []

  const handleAction = (action: string) => {
    switch (action) {
      case "confirm":
        run(() => confirmMut.mutateAsync(booking.id), t("bookings.actions.toast.confirmed"))
        break
      case "checkin":
        run(() => checkInMut.mutateAsync(booking.id), t("bookings.actions.toast.checkedIn"))
        break
      case "start":
        toast.error(t("bookings.actions.toast.genericError"))
        break
      case "complete":
        run(() => completeMut.mutateAsync(booking.id), t("bookings.actions.toast.completed"))
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
    }
  }

  if (actions.length === 0) return null

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
          toast.error(t("bookings.actions.toast.genericError"))
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
          toast.error(t("bookings.actions.toast.genericError"))
          resetDialog()
        }}
      />

      <AdminCancelDialog
        open={cancelDialog === "admin"}
        cancelReason={cancelReason}
        setCancelReason={setCancelReason}
        refundType={refundType}
        setRefundType={setRefundType}
        refundAmount={refundAmount}
        setRefundAmount={setRefundAmount}
        adminNotes={adminNotes}
        setAdminNotes={setAdminNotes}
        loading={loading}
        onReset={resetDialog}
        onCancel={async () => {
          if (!cancelReason.trim()) {
            toast.error(t("bookings.actions.validation.reasonRequired"))
            return
          }
          if (refundType === "partial" && (!refundAmount || Number(refundAmount) < 1)) {
            toast.error(t("bookings.actions.validation.refundAmountRequired"))
            return
          }
          await run(
            () => adminCancelMut.mutateAsync({
              id: booking.id,
              reason: cancelReason,
              refundType,
              refundAmount: refundType === "partial" ? Number(refundAmount) : undefined,
              adminNotes: adminNotes || undefined,
            }),
            t("bookings.actions.toast.cancelled"),
          )
          resetDialog()
        }}
      />
    </>
  )
}
