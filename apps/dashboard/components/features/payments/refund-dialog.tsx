"use client"

import { useMemo } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"

import { Button } from "@sawaa/ui"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from "@sawaa/ui"
import { Input } from "@sawaa/ui"
import { Label } from "@sawaa/ui"
import { Textarea } from "@sawaa/ui"
import { useLocale } from "@/components/locale-provider"
import { usePaymentMutations } from "@/hooks/use-payments"
import { sarToHalalas, halalasToSar } from "@/lib/money"

/* ─── Types ─── */

type RefundForm = { reason: string; amount?: string }

/* ─── Props ─── */

interface RefundDialogProps {
  paymentId: string
  /** المبلغ الأصلي للدفعة بالهللة — يُستخدم كحد أقصى للاسترجاع */
  maxAmount?: number
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

/* ─── Component ─── */

export function RefundDialog({
  paymentId,
  maxAmount,
  open,
  onOpenChange,
  onSuccess,
}: RefundDialogProps) {
  const { t } = useLocale()
  const { refundMut } = usePaymentMutations()

  const maxAmountSar = useMemo(
    () => (maxAmount != null ? halalasToSar(maxAmount) : undefined),
    [maxAmount],
  )

  const refundSchema = useMemo(
    () =>
      z.object({
        reason: z.string().min(1, t("refund.validation.reasonRequired")),
        amount: z
          .string()
          .optional()
          .refine(
            (v) => !v || (!isNaN(Number(v)) && Number(v) > 0),
            t("refund.validation.invalidAmount"),
          )
          .refine(
            (v) => !v || !maxAmountSar || Number(v) <= maxAmountSar,
            t("refund.validation.maxAmount").replace("{max}", String(maxAmountSar ?? "")),
          ),
      }),
    [t, maxAmountSar],
  )

  const form = useForm<RefundForm>({
    resolver: zodResolver(refundSchema),
    defaultValues: { reason: "", amount: "" },
  })

  const onSubmit = form.handleSubmit(async (data) => {
    try {
      const parsedAmount = data.amount ? sarToHalalas(Number(data.amount)) : undefined
      await refundMut.mutateAsync({
        id: paymentId,
        reason: data.reason,
        amount: parsedAmount,
      })
      toast.success(t("refund.successToast"))
      form.reset()
      onOpenChange(false)
      onSuccess()
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t("refund.errorToast"),
      )
    }
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("refund.title")}</DialogTitle>
          <DialogDescription>
            {t("refund.description")}
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <form id="refund-form" onSubmit={onSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="refund-reason">{t("refund.reasonLabel")}</Label>
              <Textarea
                id="refund-reason"
                placeholder={t("refund.reasonPlaceholder")}
                rows={3}
                {...form.register("reason")}
              />
              {form.formState.errors.reason && (
                <p className="text-xs text-error">
                  {form.formState.errors.reason.message}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="refund-amount">
                {t("refund.amountLabel")}
                {maxAmountSar != null && (
                  <span className="ms-1 font-numeric text-muted-foreground">
                    {t("refund.amountMax").replace("{max}", String(maxAmountSar))}
                  </span>
                )}
              </Label>
              <Input
                id="refund-amount"
                type="number"
                min={0.01}
                step={0.01}
                max={maxAmountSar}
                placeholder={t("refund.amountPlaceholder")}
                {...form.register("amount")}
              />
              {form.formState.errors.amount && (
                <p className="text-xs text-error">
                  {form.formState.errors.amount.message}
                </p>
              )}
            </div>
          </form>
        </DialogBody>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            {t("refund.cancel")}
          </Button>
          <Button type="submit" size="sm" form="refund-form" disabled={refundMut.isPending}>
            {refundMut.isPending ? t("refund.submitting") : t("refund.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
