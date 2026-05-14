"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
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
import { Label } from "@deqah/ui"
import { Textarea } from "@deqah/ui"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@deqah/ui"

import { useLocale } from "@/components/locale-provider"
import { usePaymentMutations } from "@/hooks/use-payments"
import {
  verifyTransferSchema,
  type VerifyTransferFormData,
} from "@/lib/schemas/payment.schema"

/* ─── Props ─── */

interface VerifyDialogProps {
  paymentId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

/* ─── Component ─── */

export function VerifyDialog({
  paymentId,
  open,
  onOpenChange,
  onSuccess,
}: VerifyDialogProps) {
  const { t } = useLocale()
  const { verifyMut } = usePaymentMutations()

  const form = useForm<VerifyTransferFormData>({
    resolver: zodResolver(verifyTransferSchema),
    defaultValues: { action: undefined, transferRef: "" },
  })

  const onSubmit = form.handleSubmit(async (data: VerifyTransferFormData) => {
    try {
      await verifyMut.mutateAsync({
        id: paymentId,
        action: data.action,
        transferRef: data.transferRef || undefined,
      })
      toast.success(
        data.action === "approve" ? "Transfer approved" : "Transfer rejected"
      )
      form.reset()
      onOpenChange(false)
      onSuccess()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Verification failed")
    }
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("payments.verify.title")}</DialogTitle>
          <DialogDescription>
            {t("payments.verify.description")}
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <form
            id="verify-transfer-form"
            onSubmit={onSubmit}
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-2">
              <Label>{t("payments.verify.actionLabel")}</Label>
              <Select
                value={form.watch("action") ?? ""}
                onValueChange={(v) =>
                  form.setValue("action", v as "approve" | "reject", {
                    shouldValidate: true,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select action" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="approve">
                    {t("payments.verify.approve")}
                  </SelectItem>
                  <SelectItem value="reject">
                    {t("payments.verify.reject")}
                  </SelectItem>
                </SelectContent>
              </Select>
              {form.formState.errors.action && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.action.message}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="verify-notes">
                Transfer Reference (optional)
              </Label>
              <Textarea
                id="verify-notes"
                placeholder="Bank transfer reference number..."
                rows={3}
                {...form.register("transferRef")}
              />
            </div>
          </form>
        </DialogBody>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="verify-transfer-form"
            disabled={verifyMut.isPending}
          >
            {verifyMut.isPending ? "Processing..." : "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
