"use client"

import { useEffect, useMemo, useState } from "react"
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
import { useLocale } from "@/components/locale-provider"
import { FormattedCurrency } from "@/components/features/shared/sar-symbol"
import {
  PaymentMethodPicker,
  resolveActiveMethod,
  type PayMethod,
} from "@/components/features/shared/payment-method-picker"
import { useRecordPaymentMutations } from "@/hooks/use-payments"
import { useDiscountReasons } from "@/hooks/use-discount-reasons"
import { usePaymentSettings } from "@/hooks/use-organization-settings"
import { showApiError } from "@/lib/mutation-helpers"
import { createIdempotencyKey } from "@/lib/idempotency"
import { halalasToSar } from "@/lib/money"
import {
  moneyInputToHalalas,
  normalizeMoneyInput,
  parseMoneyInput,
} from "@/lib/money-input"
import type { CollectBookingPaymentPayload } from "@/lib/api/payments"
import type { Booking, BookingInvoice } from "@/lib/types/booking"

interface RecordPaymentDialogProps {
  booking: Booking
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** `bookings.recordPayment.method.*` namespace, owned by the record-payment flow. */
const RECORD_PAYMENT_METHOD_LABEL_KEYS: Record<PayMethod, string> = {
  CASH: "bookings.recordPayment.method.cash",
  BANK_TRANSFER: "bookings.recordPayment.method.bankTransfer",
  MADA: "bookings.recordPayment.method.mada",
  TABBY: "bookings.recordPayment.method.tabby",
}

export function RecordPaymentDialog({
  booking,
  open,
  onOpenChange,
}: RecordPaymentDialogProps) {
  const { t } = useLocale()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("bookings.recordPayment.title")}</DialogTitle>
          <DialogDescription>
            {t("bookings.recordPayment.description")}
          </DialogDescription>
        </DialogHeader>
        {/* Remount on open so the form state seeds fresh from the booking — no reset effect. */}
        {open && (
          <RecordPaymentForm
            key={booking.id}
            booking={booking}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function RecordPaymentForm({
  booking,
  onClose,
}: {
  booking: Booking
  onClose: () => void
}) {
  const { t } = useLocale()
  const { collectMut, ensureInvoiceMut } = useRecordPaymentMutations()
  const { data: reasons = [] } = useDiscountReasons()
  const { data: paymentSettings } = usePaymentSettings()

  // Pay-at-clinic bookings carry no invoice until completion. Materialise a DRAFT
  // one on open so reception can record an upfront payment against it.
  const [ensured, setEnsured] = useState<BookingInvoice | null>(booking.invoice)
  useEffect(() => {
    if (booking.invoice || ensured) return
    ensureInvoiceMut
      .mutateAsync(booking.id)
      .then(setEnsured)
      .catch((err) =>
        showApiError(err, {
          fallback: t("bookings.recordPayment.errorToast"),
          t,
        })
      )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const invoice = ensured
  // Outstanding before any discount entered in this dialog.
  const subtotalSar = halalasToSar(invoice?.subtotal ?? 0)
  const vatRate = invoice?.vatRate ?? 0

  // Initial state matches the original behavior: with paymentSettings undefined
  // at first render, the shared helper resolves enabled methods to [CASH], so
  // seeding with "CASH" produces the same DOM and submission path.
  const [method, setMethod] = useState<PayMethod>("CASH")
  // If the selected method gets disabled (settings load late), fall back to the first enabled one.
  const activeMethod = resolveActiveMethod(paymentSettings, method)
  const [discountSar, setDiscountSar] = useState("")
  const [discountReasonId, setDiscountReasonId] = useState("")
  // One key belongs to one user operation. It intentionally survives a failed
  // request so a retry replays the same server-side idempotent operation.
  const [idempotencyKey, setIdempotencyKey] = useState(createIdempotencyKey)

  const subtotalHalalas = invoice?.subtotal ?? 0
  const baseOutstandingHalalas = invoice?.outstanding ?? 0
  const parsedDiscount = parseMoneyInput(discountSar)
  const discountHalalas =
    discountSar.trim() === "" ? 0 : moneyInputToHalalas(discountSar)
  const hasDiscount = discountHalalas !== null && discountHalalas > 0
  const discountAmountValid =
    discountSar.trim() === "" ||
    (parsedDiscount !== null &&
      discountHalalas !== null &&
      discountHalalas <= subtotalHalalas)
  const fullDiscount =
    discountAmountValid && hasDiscount && discountHalalas === subtotalHalalas
  const discountValid =
    discountAmountValid && (!hasDiscount || discountReasonId !== "")

  // The discount applies to the net subtotal, so VAT is recomputed on the
  // reduced base — matching the backend. payable = (subtotal − discount) × (1 + vatRate).
  const payableHalalas = useMemo(() => {
    if (!hasDiscount) return baseOutstandingHalalas
    const netSubtotalHalalas = Math.max(
      0,
      subtotalHalalas - (discountHalalas ?? 0)
    )
    // Match the backend's integer-halalas VAT calculation: round VAT once,
    // then add it to the reduced subtotal.
    return netSubtotalHalalas + Math.round(netSubtotalHalalas * vatRate)
  }, [
    baseOutstandingHalalas,
    discountHalalas,
    hasDiscount,
    subtotalHalalas,
    vatRate,
  ])
  const payableSar = halalasToSar(payableHalalas)

  // Collection is always for the complete post-discount payable. The amount is
  // displayed for clarity, but is intentionally not an independent input.
  const amountSar = payableSar.toFixed(2)
  const payableValid = fullDiscount || payableHalalas > 0
  const canSubmit =
    !!invoice &&
    discountValid &&
    payableValid &&
    !collectMut.isPending &&
    !ensureInvoiceMut.isPending

  async function onSubmit() {
    if (!invoice || !discountValid || !payableValid) return

    const payload: CollectBookingPaymentPayload = {
      method: activeMethod,
      idempotencyKey,
    }
    if (hasDiscount && discountHalalas !== null) {
      payload.discountAmt = discountHalalas
      payload.discountReasonId = discountReasonId
    }
    // The backend treats an omitted amount after a full discount as a
    // successful zero-money collection and returns payment: null.
    if (!fullDiscount) payload.amount = payableHalalas

    try {
      await collectMut.mutateAsync({
        bookingId: booking.id,
        ...payload,
      })
      toast.success(t("bookings.recordPayment.successToast"))
      setIdempotencyKey(createIdempotencyKey())
      onClose()
    } catch (err) {
      showApiError(err, { fallback: t("bookings.recordPayment.errorToast"), t })
    }
  }

  return (
    <>
      <DialogBody>
        {!invoice ? (
          <p className="text-sm text-muted-foreground">
            {ensureInvoiceMut.isError
              ? t("bookings.recordPayment.noInvoice")
              : t("bookings.recordPayment.preparingInvoice")}
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 px-3 py-2">
              <span className="text-sm text-muted-foreground">
                {t("bookings.recordPayment.outstanding")}
              </span>
              <span className="text-sm font-semibold tabular-nums">
                <FormattedCurrency
                  amount={invoice.outstanding}
                  locale="ar"
                  decimals={2}
                />
              </span>
            </div>

            <div className="flex flex-col gap-2">
              <Label>{t("bookings.recordPayment.method")}</Label>
              <PaymentMethodPicker
                paymentSettings={paymentSettings}
                method={method}
                onChange={setMethod}
                labelKeys={RECORD_PAYMENT_METHOD_LABEL_KEYS}
                ariaLabel={t("bookings.recordPayment.method")}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="pay-discount">
                {t("bookings.recordPayment.discount")}
              </Label>
              <Input
                id="pay-discount"
                type="text"
                inputMode="decimal"
                min={0}
                step={0.01}
                max={subtotalSar}
                placeholder="0.00"
                className="tabular-nums"
                value={discountSar}
                onChange={(e) =>
                  setDiscountSar(normalizeMoneyInput(e.target.value))
                }
              />
            </div>

            {hasDiscount && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="pay-discount-reason">
                  {t("bookings.recordPayment.discountReason")}
                </Label>
                <Select
                  value={discountReasonId}
                  onValueChange={setDiscountReasonId}
                >
                  <SelectTrigger id="pay-discount-reason">
                    <SelectValue
                      placeholder={t(
                        "bookings.recordPayment.discountReasonPlaceholder"
                      )}
                    />
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
                  <p className="text-xs text-destructive">
                    {t("bookings.recordPayment.reasonRequired")}
                  </p>
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
                type="text"
                className="tabular-nums"
                value={amountSar}
                readOnly
              />
            </div>
          </div>
        )}
      </DialogBody>

      <DialogFooter>
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          {t("bookings.recordPayment.cancel")}
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={!canSubmit}
          onClick={onSubmit}
        >
          {collectMut.isPending || ensureInvoiceMut.isPending
            ? t("bookings.recordPayment.submitting")
            : t("bookings.recordPayment.submit")}
        </Button>
      </DialogFooter>
    </>
  )
}
