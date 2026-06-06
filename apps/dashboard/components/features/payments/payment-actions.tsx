"use client"

import { useState } from "react"

import { Button } from "@sawaa/ui"

import type { Payment } from "@/lib/types/payment"
import { useLocale } from "@/components/locale-provider"
import { RefundDialog } from "./refund-dialog"
import { VerifyDialog } from "./verify-dialog"

/* ─── Props ─── */

interface PaymentActionsProps {
  payment: Payment
  onAction: () => void
}

/* ─── Component ─── */

export function PaymentActions({ payment, onAction }: PaymentActionsProps) {
  const { t } = useLocale()
  const [refundOpen, setRefundOpen] = useState(false)
  const [verifyOpen, setVerifyOpen] = useState(false)

  const canRefund = payment.status === "COMPLETED"
  const refundableAmount = Math.max(
    Number(payment.amount) - Number(payment.refundedAmount ?? 0),
    0,
  )
  const canVerify =
    payment.method === "BANK_TRANSFER" &&
    payment.receipts &&
    payment.receipts.length > 0

  return (
    <>
      <div className="flex flex-wrap gap-2 pb-4">
        {canRefund && (
          <Button size="sm" onClick={() => setRefundOpen(true)}>
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

      <RefundDialog
        paymentId={payment.id}
        maxAmount={refundableAmount}
        open={refundOpen}
        onOpenChange={setRefundOpen}
        onSuccess={onAction}
      />

      <VerifyDialog
        paymentId={payment.id}
        open={verifyOpen}
        onOpenChange={setVerifyOpen}
        onSuccess={onAction}
      />
    </>
  )
}
