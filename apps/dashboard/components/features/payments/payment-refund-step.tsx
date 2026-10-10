"use client"

import { useState } from "react"
import { toast } from "sonner"
import { DialogBody, DialogFooter, Button, Input, Label, Textarea } from "@sawaa/ui"
import { useLocale } from "@/components/locale-provider"
import { usePaymentMutations } from "@/hooks/use-payments"
import { showApiError } from "@/lib/mutation-helpers"
import { sarToHalalas, halalasToSar } from "@/lib/money"
import type { Payment } from "@/lib/types/payment"

/* ─── Inline refund step (replaces the detail content; no stacked modal) ─── */

export function PaymentRefundStep({
  payment,
  onBack,
  onDone,
}: {
  payment: Payment
  onBack: () => void
  onDone: () => void
}) {
  const { t } = useLocale()
  const { refundMut, manualRefundMut } = usePaymentMutations()

  // Off-gateway payments (cash/mada/bank-transfer, identified by method) refund through
  // the manual path; card/gateway payments go through Moyasar.
  const isManual = payment.method !== "ONLINE_CARD"
  const mut = isManual ? manualRefundMut : refundMut

  const maxSar = halalasToSar(Math.max(Number(payment.amount) - Number(payment.refundedAmount ?? 0), 0))
  const [reason, setReason] = useState("")
  const [amountSar, setAmountSar] = useState("")

  const amountNum = Number(amountSar) || 0
  const amountValid = !amountSar || (amountNum > 0 && amountNum <= maxSar)
  const canSubmit = reason.trim().length > 0 && amountValid && !mut.isPending

  async function onSubmit() {
    try {
      await mut.mutateAsync({
        id: payment.id,
        reason: reason.trim(),
        amount: amountSar ? sarToHalalas(amountNum) : undefined,
        invoiceId: payment.invoiceId,
        bookingId: payment.invoice?.bookingId,
        clientId: payment.invoice?.clientId,
      })
      toast.success(t("refund.successToast"))
      onDone()
    } catch (err) {
      showApiError(err, { fallback: t("refund.errorToast"), t })
    }
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-200">
      <DialogBody>
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">{t("refund.description")}</p>
          <div className="flex flex-col gap-2">
            <Label htmlFor="payment-refund-reason">{t("refund.reasonLabel")}</Label>
            <Textarea
              id="payment-refund-reason"
              placeholder={t("refund.reasonPlaceholder")}
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="payment-refund-amount">
              {t("refund.amountLabel")}
              <span className="ms-1 font-numeric text-muted-foreground tabular-nums">
                {t("refund.amountMax").replace("{max}", String(maxSar))}
              </span>
            </Label>
            <Input
              id="payment-refund-amount"
              type="number"
              min={0.01}
              step={0.01}
              max={maxSar}
              placeholder={t("refund.amountPlaceholder")}
              className="tabular-nums"
              value={amountSar}
              onChange={(e) => setAmountSar(e.target.value)}
            />
            {!amountValid && <p className="text-xs text-error">{t("refund.validation.invalidAmount")}</p>}
          </div>
        </div>
      </DialogBody>
      <DialogFooter>
        <Button type="button" variant="outline" size="sm" onClick={onBack}>
          {t("common.back")}
        </Button>
        <Button type="button" size="sm" disabled={!canSubmit} onClick={onSubmit}>
          {mut.isPending ? t("refund.submitting") : t("refund.submit")}
        </Button>
      </DialogFooter>
    </div>
  )
}
