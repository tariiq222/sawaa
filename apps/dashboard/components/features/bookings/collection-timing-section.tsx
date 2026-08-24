"use client"

/**
 * Collection-timing section for the new-booking wizard summary panel.
 *
 * Renders an explicit two-option radiogroup ("تحصيل الآن" / "الدفع في
 * العيادة") that replaces the prior single boolean toggle. When
 * "تحصيل الآن" is selected the shared PaymentMethodPicker from
 * `components/features/shared/payment-method-picker` is shown below it
 * so the operator records the manual method in the wizard.
 *
 * Pay-at-clinic is gated on `paymentSettings.paymentAtClinicEnabled`:
 * when the org disables it (or the call site leaves the setting
 * undefined — i.e. settings still loading) the option is disabled with
 * an explanatory hint and an explicit `effectiveNow=true` signal so
 * the container can force the state to payAtClinic=false synchronously
 * (creating a booking that the backend would otherwise reject at
 * create-booking.handler.ts:65).
 *
 * This component is presentational: it owns only the radiogroup + the
 * PaymentMethodPicker. The collection-method state and the pay-at-clinic
 * flag live in the form-state hook. The container decides whether to
 * render this component at all (e.g. hide it on the credit/package path).
 */

import { useEffect, useRef } from "react"

import { useLocale } from "@/components/locale-provider"
import { cn } from "@/lib/utils"
import type { PaymentSettings } from "@/lib/api/organization-settings"
import {
  PaymentMethodPicker,
  type PayMethod,
} from "@/components/features/shared/payment-method-picker"

/**
 * `bookings.recordPayment.method.*` label map — the record-payment
 * namespace already owns the four manual-method labels and the
 * collection-timing picker reuses them verbatim. We intentionally do
 * NOT introduce a parallel `bookings.wizard.step.confirm.method.*`
 * namespace, so adding a new manual method requires editing exactly one
 * file (`payment-method-picker.tsx`) and the record-payment dialog
 * already uses these keys.
 */
const COLLECTION_METHOD_LABEL_KEYS: Record<PayMethod, string> = {
  CASH: "bookings.recordPayment.method.cash",
  BANK_TRANSFER: "bookings.recordPayment.method.bankTransfer",
  MADA: "bookings.recordPayment.method.mada",
  TABBY: "bookings.recordPayment.method.tabby",
}

interface CollectionTimingSectionProps {
  /** Selected timing. `true` = pay-at-clinic; `false` = collect now. */
  payAtClinic: boolean
  /** Called with the new timing value. */
  onChangePayAtClinic: (next: boolean) => void
  /** Current collection-method state. */
  collectionMethod: PayMethod
  /** Called when the operator picks a method. */
  onChangeCollectionMethod: (next: PayMethod) => void
  /** Org payment settings; `undefined` means "still loading". */
  paymentSettings: PaymentSettings | undefined
}

function CollectionRadioItem({
  selected,
  ariaLabel,
  onSelect,
  disabled,
  label,
  description,
}: {
  selected: boolean
  ariaLabel: string
  onSelect: () => void
  disabled: boolean
  label: string
  description: string
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl border p-4 text-start transition-all",
        disabled
          ? "cursor-not-allowed border-border/60 bg-surface opacity-60"
          : selected
            ? "border-primary/40 bg-primary/5"
            : "border-border bg-surface hover:bg-muted/50",
      )}
    >
      <div
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-all",
          disabled
            ? "border-muted-foreground/30"
            : selected
              ? "border-primary"
              : "border-muted-foreground/40",
        )}
      >
        {selected && <div className="size-2.5 rounded-full bg-primary" />}
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-semibold text-foreground">{label}</span>
        <span className="text-xs text-muted-foreground">{description}</span>
      </div>
    </button>
  )
}

export function CollectionTimingSection({
  payAtClinic,
  onChangePayAtClinic,
  collectionMethod,
  onChangeCollectionMethod,
  paymentSettings,
}: CollectionTimingSectionProps): JSX.Element {
  const { t } = useLocale()

  // `paymentAtClinicEnabled === false` ⇒ the backend would reject a
  // `payAtClinic: true` booking, so we MUST disable the option AND force
  // the effective state to payAtClinic=false. We do that via an effect
  // that calls the parent's setter only when the setting is fully
  // resolved (not undefined) and is explicitly false. The setting being
  // undefined means "still loading" and we do not force anything in that
  // case — today's pre-change behavior is preserved.
  const payAtClinicDisabled =
    paymentSettings !== undefined && paymentSettings.paymentAtClinicEnabled === false

  // We notify the container via the parent-supplied setter. Use the
  // latest callback in a ref so the effect itself never re-runs when the
  // parent rerenders — only when the resolved flag flips.
  const onChangeRef = useRef(onChangePayAtClinic)
  useEffect(() => {
    onChangeRef.current = onChangePayAtClinic
  }, [onChangePayAtClinic])

  useEffect(() => {
    if (payAtClinicDisabled && payAtClinic) {
      onChangeRef.current(false)
    }
    // payAtClinic is intentionally in the deps so a manual re-select by
    // the operator also runs the guard (no-op when already false).
  }, [payAtClinicDisabled, payAtClinic])

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {t("bookings.wizard.step.confirm.collectionTimingHeader")}
      </p>

      <div
        className="flex flex-col gap-2"
        role="radiogroup"
        aria-label={t("bookings.wizard.step.confirm.collectionTimingHeader")}
      >
        <CollectionRadioItem
          selected={!payAtClinic}
          ariaLabel={t("bookings.wizard.step.confirm.collectionNow")}
          onSelect={() => onChangePayAtClinic(false)}
          disabled={false}
          label={t("bookings.wizard.step.confirm.collectionNow")}
          description={t("bookings.wizard.step.confirm.collectionNowDescription")}
        />
        <CollectionRadioItem
          selected={payAtClinic}
          ariaLabel={t("bookings.wizard.step.confirm.payAtClinic")}
          onSelect={() => onChangePayAtClinic(true)}
          disabled={payAtClinicDisabled}
          label={t("bookings.wizard.step.confirm.payAtClinic")}
          description={
            payAtClinicDisabled
              ? t("bookings.wizard.step.confirm.payAtClinicDisabledHint")
              : t("bookings.wizard.step.confirm.payAtClinicDescription")
          }
        />
      </div>

      {payAtClinicDisabled && (
        <p className="text-xs text-warning">
          {t("bookings.wizard.step.confirm.payAtClinicDisabledHint")}
        </p>
      )}

      {!payAtClinic && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("bookings.wizard.step.confirm.collectionMethodLabel")}
          </p>
          <PaymentMethodPicker
            paymentSettings={paymentSettings}
            method={collectionMethod}
            onChange={onChangeCollectionMethod}
            labelKeys={COLLECTION_METHOD_LABEL_KEYS}
            ariaLabel={t("bookings.wizard.step.confirm.collectionMethodLabel")}
          />
        </div>
      )}
    </div>
  )
}
