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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@sawaa/ui"
import { cn } from "@/lib/utils"
import { useLocale } from "@/components/locale-provider"
import { FormattedCurrency } from "@/components/features/shared/sar-symbol"
import { useRecordPaymentMutations } from "@/hooks/use-payments"
import { useDiscountReasons } from "@/hooks/use-discount-reasons"
import { usePaymentSettings } from "@/hooks/use-organization-settings"
import { sarToHalalas, halalasToSar } from "@/lib/money"
import type { Booking } from "@/lib/types/booking"

interface RecordPaymentDialogProps {
  booking: Booking
  open: boolean
  onOpenChange: (open: boolean) => void
}

type PayMethod = "CASH" | "BANK_TRANSFER" | "MADA" | "TABBY"

const METHOD_OPTIONS: { value: PayMethod; labelKey: string; settingKey: "payMethodCashEnabled" | "payMethodBankEnabled" | "payMethodMadaEnabled" | "payMethodTabbyEnabled" }[] = [
  { value: "CASH", labelKey: "bookings.recordPayment.method.cash", settingKey: "payMethodCashEnabled" },
  { value: "BANK_TRANSFER", labelKey: "bookings.recordPayment.method.bankTransfer", settingKey: "payMethodBankEnabled" },
  { value: "MADA", labelKey: "bookings.recordPayment.method.mada", settingKey: "payMethodMadaEnabled" },
  { value: "TABBY", labelKey: "bookings.recordPayment.method.tabby", settingKey: "payMethodTabbyEnabled" },
]

export function RecordPaymentDialog({ booking, open, onOpenChange }: RecordPaymentDialogProps) {
  const { t } = useLocale()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("bookings.recordPayment.title")}</DialogTitle>
          <DialogDescription>{t("bookings.recordPayment.description")}</DialogDescription>
        </DialogHeader>
        {/* Remount on open so the form state seeds fresh from the booking — no reset effect. */}
        {open && <RecordPaymentForm booking={booking} onClose={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function RecordPaymentForm({ booking, onClose }: { booking: Booking; onClose: () => void }) {
  const { t } = useLocale()
  const { applyDiscountMut, recordMut } = useRecordPaymentMutations()
  const { data: reasons = [] } = useDiscountReasons()
  const { data: paymentSettings } = usePaymentSettings()

  // Methods the clinic has enabled in settings. Cash is the safe fallback so the
  // dialog is never actionless while settings load.
  const enabledMethods = useMemo(() => {
    const list = METHOD_OPTIONS.filter((m) => paymentSettings?.[m.settingKey])
    return list.length > 0 ? list : METHOD_OPTIONS.filter((m) => m.value === "CASH")
  }, [paymentSettings])

  const invoice = booking.invoice
  // Outstanding before any discount entered in this dialog.
  const baseOutstandingSar = halalasToSar(invoice?.outstanding ?? 0)
  const subtotalSar = halalasToSar(invoice?.subtotal ?? 0)
  const vatRate = invoice?.vatRate ?? 0

  const [method, setMethod] = useState<PayMethod>(enabledMethods[0]?.value ?? "CASH")
  // If the selected method gets disabled (settings load late), fall back to the first enabled one.
  const activeMethod = enabledMethods.some((m) => m.value === method) ? method : (enabledMethods[0]?.value ?? "CASH")
  const [discountSar, setDiscountSar] = useState("")
  const [discountReasonId, setDiscountReasonId] = useState("")
  // null = follow the payable total automatically; a string = user typed an explicit amount.
  const [amountOverride, setAmountOverride] = useState<string | null>(null)

  const discountNum = Number(discountSar) || 0
  // The discount applies to the net subtotal, so VAT is recomputed on the
  // reduced base — matching the backend. payable = (subtotal − discount) × (1 + vatRate).
  const payableSar = useMemo(() => {
    if (discountNum <= 0) return baseOutstandingSar
    const net = Math.max(0, subtotalSar - discountNum)
    return Math.round(net * (1 + vatRate) * 100) / 100
  }, [discountNum, baseOutstandingSar, subtotalSar, vatRate])

  // Until the user edits the amount, it tracks the payable total so a discount
  // immediately reduces what's collected (no stale "exceeds outstanding" error).
  const amountSar = amountOverride ?? String(payableSar)
  const amountNum = Number(amountSar) || 0
  const hasDiscount = discountNum > 0
  const discountValid = !hasDiscount || discountReasonId !== ""
  const amountValid = amountNum > 0 && amountNum <= payableSar
  const canSubmit = !!invoice && discountValid && amountValid && !recordMut.isPending && !applyDiscountMut.isPending

  async function onSubmit() {
    if (!invoice) return
    try {
      if (hasDiscount) {
        await applyDiscountMut.mutateAsync({
          invoiceId: invoice.id,
          discountAmt: sarToHalalas(discountNum),
          discountReasonId,
        })
      }
      await recordMut.mutateAsync({
        invoiceId: invoice.id,
        amount: sarToHalalas(amountNum),
        method: activeMethod,
      })
      toast.success(t("bookings.recordPayment.successToast"))
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("bookings.recordPayment.errorToast"))
    }
  }

  return (
    <>
      <DialogBody>
          {!invoice ? (
            <p className="text-sm text-muted-foreground">{t("bookings.recordPayment.noInvoice")}</p>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 px-3 py-2">
                <span className="text-sm text-muted-foreground">{t("bookings.recordPayment.outstanding")}</span>
                <span className="text-sm font-semibold tabular-nums">
                  <FormattedCurrency amount={invoice.outstanding} locale="ar" decimals={2} />
                </span>
              </div>

              <div className="flex flex-col gap-2">
                <Label>{t("bookings.recordPayment.method")}</Label>
                <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={t("bookings.recordPayment.method")}>
                  {enabledMethods.map((m) => {
                    const selected = activeMethod === m.value
                    return (
                      <button
                        key={m.value}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => setMethod(m.value)}
                        className={cn(
                          "rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors",
                          selected
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-surface text-foreground hover:bg-muted",
                        )}
                      >
                        {t(m.labelKey)}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="pay-discount">{t("bookings.recordPayment.discount")}</Label>
                <Input
                  id="pay-discount"
                  type="number"
                  min={0}
                  step={0.01}
                  max={subtotalSar}
                  placeholder="0.00"
                  className="tabular-nums"
                  value={discountSar}
                  onChange={(e) => setDiscountSar(e.target.value)}
                />
              </div>

              {hasDiscount && (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="pay-discount-reason">{t("bookings.recordPayment.discountReason")}</Label>
                  <Select value={discountReasonId} onValueChange={setDiscountReasonId}>
                    <SelectTrigger id="pay-discount-reason">
                      <SelectValue placeholder={t("bookings.recordPayment.discountReasonPlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      {reasons.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.labelAr}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!discountValid && (
                    <p className="text-xs text-destructive">{t("bookings.recordPayment.reasonRequired")}</p>
                  )}
                </div>
              )}

              <div className="flex flex-col gap-2">
                <Label htmlFor="pay-amount">
                  {t("bookings.recordPayment.amount")}
                  <span className="ms-1 font-numeric text-muted-foreground tabular-nums">
                    ({payableSar.toFixed(2)})
                  </span>
                </Label>
                <Input
                  id="pay-amount"
                  type="number"
                  min={0.01}
                  step={0.01}
                  max={payableSar}
                  placeholder="0.00"
                  className="tabular-nums"
                  value={amountSar}
                  onChange={(e) => setAmountOverride(e.target.value)}
                />
                {amountNum > payableSar && (
                  <p className="text-xs text-destructive">{t("bookings.recordPayment.amountTooHigh")}</p>
                )}
              </div>
            </div>
          )}
      </DialogBody>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          {t("bookings.recordPayment.cancel")}
        </Button>
        <Button type="button" disabled={!canSubmit} onClick={onSubmit}>
          {recordMut.isPending || applyDiscountMut.isPending
            ? t("bookings.recordPayment.submitting")
            : t("bookings.recordPayment.submit")}
        </Button>
      </DialogFooter>
    </>
  )
}
