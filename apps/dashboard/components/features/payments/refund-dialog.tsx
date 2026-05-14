"use client"

import { useMemo } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"

import { Button } from "@deqah/ui"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from "@deqah/ui"
import { Input } from "@deqah/ui"
import { Label } from "@deqah/ui"
import { Textarea } from "@deqah/ui"
import { useLocale } from "@/components/locale-provider"
import { usePaymentMutations } from "@/hooks/use-payments"

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
            (v) => !v || !maxAmount || Number(v) <= maxAmount,
            t("refund.validation.maxAmount").replace("{max}", String(maxAmount ?? "")),
          ),
      }),
    [t, maxAmount],
  )

  const form = useForm<RefundForm>({
    resolver: zodResolver(refundSchema),
    defaultValues: { reason: "", amount: "" },
  })

  const onSubmit = form.handleSubmit(async (data) => {
    try {
      const parsedAmount = data.amount ? Number(data.amount) : undefined
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
                <p className="text-xs text-destructive">
                  {form.formState.errors.reason.message}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="refund-amount">
                {t("refund.amountLabel")}
                {maxAmount && (
                  <span className="ms-1 font-numeric text-muted-foreground">
                    {t("refund.amountMax").replace("{max}", String(maxAmount))}
                  </span>
                )}
              </Label>
              <Input
                id="refund-amount"
                type="number"
                min={1}
                max={maxAmount}
                placeholder={t("refund.amountPlaceholder")}
                {...form.register("amount")}
              />
              {form.formState.errors.amount && (
                <p className="text-xs text-destructive">
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
            onClick={() => onOpenChange(false)}
          >
            {t("refund.cancel")}
          </Button>
          <Button type="submit" form="refund-form" disabled={refundMut.isPending}>
            {refundMut.isPending ? t("refund.submitting") : t("refund.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
