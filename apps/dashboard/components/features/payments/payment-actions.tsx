"use client"

import { useState } from "react"

import { Button } from "@sawaa/ui"

import type { Payment } from "@/lib/types/payment"
import { useLocale } from "@/components/locale-provider"
import { VerifyDialog } from "./verify-dialog"

/* ─── Props ─── */

interface PaymentActionsProps {
  payment: Payment
  onAction: () => void
  /** Switch the detail dialog to its inline refund step (no stacked modal). */
  onRefund: () => void
}

/* ─── Component ─── */

export function PaymentActions({
  payment,
  onAction,
  onRefund,
}: PaymentActionsProps) {
  const { t } = useLocale()
  const [verifyOpen, setVerifyOpen] = useState(false)

  const gateway = payment.method === "ONLINE_CARD"
  const gatewayRefundBlocked =
    gateway &&
    (payment.status === "PARTIALLY_REFUNDED" ||
      Number(payment.refundedAmount ?? 0) > 0)
  const canRefund =
    !gatewayRefundBlocked &&
    Number(payment.amount) > Number(payment.refundedAmount ?? 0) &&
    (payment.status === "COMPLETED" ||
      (payment.status === "PARTIALLY_REFUNDED" && !gateway))
  const canVerify =
    payment.method === "BANK_TRANSFER" &&
    payment.status === "PENDING_VERIFICATION" &&
    (!!payment.receiptUrl || !!payment.receipts?.length)

  return (
    <>
      <div className="flex flex-wrap gap-2 pb-4">
        {gatewayRefundBlocked && (
          <p className="text-sm text-muted-foreground">
            {t("payments.refund.gatewayRemaining")}
          </p>
        )}
        {canRefund && (
          <Button size="sm" onClick={onRefund}>
            {t("detail.refund")}
          </Button>
        )}
        {canVerify && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setVerifyOpen(true)}
          >
            {t("detail.verifyTransfer")}
          </Button>
        )}
      </div>

      <VerifyDialog
        paymentId={payment.id}
        payment={payment}
        open={verifyOpen}
        onOpenChange={setVerifyOpen}
        onSuccess={onAction}
      />
    </>
  )
}
