"use client"

import { useState } from "react"

import { Button } from "@deqah/ui"

import type { Payment } from "@/lib/types/payment"
import { RefundDialog } from "./refund-dialog"
import { VerifyDialog } from "./verify-dialog"

/* ─── Props ─── */

interface PaymentActionsProps {
  payment: Payment
  onAction: () => void
}

/* ─── Component ─── */

export function PaymentActions({ payment, onAction }: PaymentActionsProps) {
  const [refundOpen, setRefundOpen] = useState(false)
  const [verifyOpen, setVerifyOpen] = useState(false)

  const canRefund = payment.status === "paid"
  const canVerify =
    payment.method === "bank_transfer" &&
    payment.receipts &&
    payment.receipts.length > 0

  return (
    <>
      <div className="flex flex-wrap gap-2 pb-4">
        {canRefund && (
          <Button size="sm" onClick={() => setRefundOpen(true)}>
            Refund
          </Button>
        )}
        {canVerify && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setVerifyOpen(true)}
          >
            Verify Transfer
          </Button>
        )}
      </div>

      <RefundDialog
        paymentId={payment.id}
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
