"use client"

import { useMemo, useState } from "react"
import { toast } from "sonner"

import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
  Input,
  Label,
  Textarea,
} from "@sawaa/ui"
import { useLocale } from "@/components/locale-provider"
import { usePaymentMutations } from "@/hooks/use-payments"
import { showApiError } from "@/lib/mutation-helpers"
import { sarToHalalas, halalasToSar } from "@/lib/money"

interface BookingRefundDialogProps {
  paymentId: string
  /** Original payment amount in halalas — the refund ceiling. */
  maxAmount: number
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Manual (cash/bank-transfer) refund issued from the bookings list. Lives in the
 * bookings feature to avoid a cross-feature import of the payments refund dialog.
 */
export function BookingRefundDialog({ paymentId, maxAmount, open, onOpenChange }: BookingRefundDialogProps) {
  const { t } = useLocale()
  const { manualRefundMut } = usePaymentMutations()

  const maxSar = useMemo(() => halalasToSar(maxAmount), [maxAmount])
  const [reason, setReason] = useState("")
  const [amountSar, setAmountSar] = useState("")

  const amountNum = Number(amountSar) || 0
  const amountValid = !amountSar || (amountNum > 0 && amountNum <= maxSar)
  const canSubmit = reason.trim().length > 0 && amountValid && !manualRefundMut.isPending

  async function onSubmit() {
    try {
      await manualRefundMut.mutateAsync({
        id: paymentId,
        reason: reason.trim(),
        amount: amountSar ? sarToHalalas(amountNum) : undefined,
      })
      toast.success(t("refund.successToast"))
      onOpenChange(false)
    } catch (err) {
      showApiError(err, { fallback: t("refund.errorToast"), t })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("refund.title")}</DialogTitle>
          <DialogDescription>{t("refund.description")}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="booking-refund-reason">{t("refund.reasonLabel")}</Label>
              <Textarea
                id="booking-refund-reason"
                placeholder={t("refund.reasonPlaceholder")}
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="booking-refund-amount">
                {t("refund.amountLabel")}
                <span className="ms-1 font-numeric text-muted-foreground tabular-nums">
                  {t("refund.amountMax").replace("{max}", String(maxSar))}
                </span>
              </Label>
              <Input
                id="booking-refund-amount"
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
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            {t("refund.cancel")}
          </Button>
          <Button type="button" size="sm" disabled={!canSubmit} onClick={onSubmit}>
            {manualRefundMut.isPending ? t("refund.submitting") : t("refund.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
