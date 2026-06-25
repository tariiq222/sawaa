"use client"

/**
 * Refund Package Form Body — Sawaa Dashboard
 *
 * Phase 5 — manual refund modal for a session-package purchase. The
 * operator enters the refund amount in SAR (we convert to integer
 * halalas at submit) plus an optional note. The form defaults the
 * refund amount to the original `amountPaid` (full refund) and
 * shows a clear warning that the action voids the remaining credits.
 *
 * Money flow:
 *   - The backend stores money in integer halalas (RefundPackagePurchaseDto
 *     declares `refundAmount: integer ≥ 0`).
 *   - The operator types a SAR value (e.g. "1500" → 1500 SAR → 150000
 *     halalas). `sarToHalalas` is the source of truth for the
 *     conversion (see lib/money → @sawaa/shared/money).
 *   - A refund of 0 halalas records a no-money cancellation: the
 *     purchase is still REFUNDED + credits still voided.
 *
 * UX gates:
 *   - Refund amount required, integer SAR ≥ 0, ≤ amountPaid.
 *   - Notes optional, ≤1000 chars (matches the backend DTO).
 *   - Submit disabled while refunding or the amount is invalid.
 *   - Disabled for purchases that are already REFUNDED (defense).
 */

import { useMemo, useState } from "react"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import { Alert02Icon } from "@hugeicons/core-free-icons"

import {
  Button,
  DialogBody,
  DialogFooter,
  Input,
  Label,
  Textarea,
} from "@sawaa/ui"

import { useRefundPackagePurchase } from "@/hooks/use-package-credit-ops"
import { useLocale } from "@/components/locale-provider"
import { showApiError } from "@/lib/mutation-helpers"
import { halalasToSar, sarToHalalas } from "@/lib/money"
import { FormattedCurrency } from "@/components/features/shared/sar-symbol"
import type { PackagePurchase } from "@/lib/types/package-purchase"

/* ─── Props ─── */

interface RefundPackageFormProps {
  purchase: PackagePurchase
  onClose: () => void
  onRefunded?: () => void
}

/* ─── Component ─── */

const MAX_NOTES = 1000

export function RefundPackageForm({
  purchase,
  onClose,
  onRefunded,
}: RefundPackageFormProps) {
  const { t, locale } = useLocale()
  const refundMut = useRefundPackagePurchase()

  // The operator types SAR; we convert to halalas at submit. Default
  // to the original amount paid (full refund). The parent remounts
  // the form on every open (see the {open && <Form .../>} pattern in
  // the dialog shell), so the useState initialiser always re-runs
  // fresh — no manual reset effect is needed.
  const defaultSar = useMemo(
    () => halalasToSar(purchase.amountPaid),
    [purchase.amountPaid],
  )
  const [refundSar, setRefundSar] = useState<string>(
    defaultSar > 0 ? String(defaultSar) : "0",
  )
  const [notes, setNotes] = useState<string>("")

  // Parse the operator input. Allow decimals ("1500.50") and coerce
  // to integer SAR before the halalas conversion.
  const refundAmountSar = useMemo(() => {
    const n = Number(refundSar.replace(/[\s,_]/g, ""))
    return Number.isFinite(n) ? n : NaN
  }, [refundSar])

  const refundAmountHalalas = useMemo(() => {
    if (!Number.isFinite(refundAmountSar)) return NaN
    if (refundAmountSar < 0) return NaN
    return sarToHalalas(refundAmountSar)
  }, [refundAmountSar])

  const isValid =
    Number.isFinite(refundAmountHalalas) &&
    refundAmountHalalas >= 0 &&
    refundAmountHalalas <= purchase.amountPaid &&
    notes.length <= MAX_NOTES &&
    !refundMut.isPending

  async function onSubmit() {
    if (!isValid) return
    try {
      await refundMut.mutateAsync({
        purchaseId: purchase.id,
        payload: {
          refundAmount: refundAmountHalalas,
          notes: notes.trim() || undefined,
        },
      })
      toast.success(t("packages.balances.refund.success"))
      onRefunded?.()
      onClose()
    } catch (err) {
      showApiError(err, {
        fallback: t("packages.balances.refund.error"),
        t,
        dedupeKey: "refund-package-error",
      })
    }
  }

  const isAlreadyRefunded = purchase.status === "REFUNDED"

  return (
    <>
      <DialogBody>
        <div className="flex flex-col gap-4">
          {/* ── Read-only purchase summary ── */}
          <div className="flex flex-col gap-1.5 rounded-lg border bg-muted/30 p-3">
            <SummaryRow
              label={t("packages.balances.refund.summary.amountPaid")}
              value={
                <FormattedCurrency
                  amount={purchase.amountPaid}
                  locale={locale}
                  decimals={2}
                />
              }
            />
            <SummaryRow
              label={t("packages.balances.refund.summary.credits")}
              value={String(purchase.credits.length)}
            />
          </div>

          {/* ── Warning when the purchase still has remaining credits ── */}
          {!isAlreadyRefunded && (
            <div
              className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 p-3 text-warning"
              role="alert"
            >
              <HugeiconsIcon
                icon={Alert02Icon}
                size={16}
                aria-hidden
                className="mt-0.5 shrink-0"
              />
              <p className="text-xs leading-relaxed">
                {t("packages.balances.refund.warning")}
              </p>
            </div>
          )}

          {/* ── Refund amount (SAR) ── */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="refund-package-amount">
              {t("packages.balances.refund.amount")}
            </Label>
            <Input
              id="refund-package-amount"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              dir="ltr"
              value={refundSar}
              onChange={(e) => setRefundSar(e.target.value)}
              disabled={isAlreadyRefunded}
              aria-label={t("packages.balances.refund.amount")}
            />
            <p className="text-xs text-muted-foreground">
              {t("packages.balances.refund.amountHelper").replace(
                "{max}",
                halalasToSar(purchase.amountPaid).toFixed(2),
              )}
            </p>
          </div>

          {/* ── Notes (optional) ── */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="refund-package-notes">
              {t("packages.balances.refund.notes")}
            </Label>
            <Textarea
              id="refund-package-notes"
              rows={2}
              maxLength={MAX_NOTES}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={isAlreadyRefunded}
              placeholder={t("packages.balances.refund.notesPlaceholder")}
            />
            <p className="text-[11px] text-muted-foreground tabular-nums">
              {notes.length} / {MAX_NOTES}
            </p>
          </div>
        </div>
      </DialogBody>
      <DialogFooter>
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          {t("packages.balances.book.cancel")}
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={onSubmit}
          disabled={!isValid || isAlreadyRefunded}
        >
          {refundMut.isPending
            ? t("packages.balances.refund.submitting")
            : t("packages.balances.refund.submit")}
        </Button>
      </DialogFooter>
    </>
  )
}

/* ─── Read-only row ─── */

function SummaryRow({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="flex items-baseline justify-between gap-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground tabular-nums">{value}</span>
    </div>
  )
}
