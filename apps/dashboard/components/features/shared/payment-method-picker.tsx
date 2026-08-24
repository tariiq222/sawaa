"use client"

/**
 * Shared manual payment-method picker — single source of truth.
 *
 * Reception-allowed manual methods only (no ONLINE_CARD, no COUPON):
 *   CASH, BANK_TRANSFER, MADA, TABBY.
 *
 * Two consumers exist today:
 *   • `wizard-steps/step-package.tsx` (label namespace: `packages.sell.method.*`)
 *   • `bookings/record-payment-dialog.tsx` (label namespace: `bookings.recordPayment.method.*`)
 *
 * Each consumer owns its own label keys (they intentionally differ) and its own
 * aria-label string, so the component takes those as props. The PaymentSettings
 * boolean key mapping and the filtering/fallback semantics live here so enabling
 * MADA later — or any future method — requires editing exactly one file.
 */

import { useLocale } from "@/components/locale-provider"
import { cn } from "@/lib/utils"
import type { PaymentSettings } from "@/lib/api/organization-settings"

/** Reception-allowed manual payment methods (no ONLINE_CARD, no COUPON). */
export type PayMethod = "CASH" | "BANK_TRANSFER" | "MADA" | "TABBY"

export type PayMethodSettingKey =
  | "payMethodCashEnabled"
  | "payMethodBankEnabled"
  | "payMethodMadaEnabled"
  | "payMethodTabbyEnabled"

export interface PaymentMethodOption {
  value: PayMethod
  settingKey: PayMethodSettingKey
}

/**
 * Canonical option list — the SINGLE source of truth for the four reception
 * methods and their PaymentSettings boolean key mapping.
 *
 * Order matters: it is the order rendered in the radiogroup and the order the
 * helpers fall back to. Keep this in sync with `apps/backend`'s payment enum.
 */
export const PAYMENT_METHODS: readonly PaymentMethodOption[] = [
  { value: "CASH", settingKey: "payMethodCashEnabled" },
  { value: "BANK_TRANSFER", settingKey: "payMethodBankEnabled" },
  { value: "MADA", settingKey: "payMethodMadaEnabled" },
  { value: "TABBY", settingKey: "payMethodTabbyEnabled" },
]

/**
 * Returns only methods the org has enabled. CASH-only fallback when every
 * method is disabled, so the picker is never actionless.
 */
export function resolveEnabledMethods(
  settings: PaymentSettings | undefined,
): PaymentMethodOption[] {
  const list = PAYMENT_METHODS.filter((m) => settings?.[m.settingKey])
  return list.length > 0
    ? list
    : PAYMENT_METHODS.filter((m) => m.value === "CASH")
}

/**
 * Single source of truth for the painted AND submitted method. Falls back to
 * the first enabled method when the operator's `method` is no longer in the
 * enabled set (e.g. settings loaded late and the previous selection is now
 * disabled). The container MUST use this for the POST payload so the chip
 * highlighted matches the value sent.
 */
export function resolveActiveMethod(
  settings: PaymentSettings | undefined,
  method: PayMethod,
): PayMethod {
  const enabled = resolveEnabledMethods(settings)
  return enabled.some((m) => m.value === method)
    ? method
    : (enabled[0]?.value as PayMethod) ?? "CASH"
}

export interface PaymentMethodPickerProps {
  paymentSettings: PaymentSettings | undefined
  method: PayMethod
  onChange: (m: PayMethod) => void
  /** Localized label key per method (each consumer owns its own namespace). */
  labelKeys: Record<PayMethod, string>
  /** Localized accessible name for the radiogroup wrapper. */
  ariaLabel: string
  /** Optional override for the wrapper className. Defaults to "grid grid-cols-3 gap-2". */
  className?: string
}

export function PaymentMethodPicker({
  paymentSettings,
  method,
  onChange,
  labelKeys,
  ariaLabel,
  className,
}: PaymentMethodPickerProps): JSX.Element {
  const { t } = useLocale()
  const active = resolveActiveMethod(paymentSettings, method)
  return (
    <div
      className={cn("grid grid-cols-3 gap-2", className)}
      role="radiogroup"
      aria-label={ariaLabel}
    >
      {resolveEnabledMethods(paymentSettings).map((m) => {
        const selected = active === m.value
        return (
          <button
            key={m.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(m.value)}
            className={cn(
              "rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors",
              selected
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-surface text-foreground hover:bg-muted",
            )}
          >
            {t(labelKeys[m.value])}
          </button>
        )
      })}
    </div>
  )
}