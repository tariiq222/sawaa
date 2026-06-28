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

export function PaymentActions({ payment, onAction, onRefund }: PaymentActionsProps) {
  const { t } = useLocale()
  const [verifyOpen, setVerifyOpen] = useState(false)

  const canRefund = payment.status === "COMPLETED"
  const canVerify =
    payment.method === "BANK_TRANSFER" &&
    payment.receipts &&
    payment.receipts.length > 0

  return (
    <>
      <div className="flex flex-wrap gap-2 pb-4">
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
        open={verifyOpen}
        onOpenChange={setVerifyOpen}
        onSuccess={onAction}
      />
    </>
  )
}
