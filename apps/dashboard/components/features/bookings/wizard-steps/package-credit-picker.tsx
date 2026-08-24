"use client"

// Phase 6 — wizard-step presentational + BUY-mode UI helpers.
//   1. `PackageCreditPicker` — pure render layer for EXISTING-mode.
//   2. Pure helpers + `MethodPicker` / `CatalogCard` sub-components used
//      by `step-package.tsx`. Co-located so the container stays under
//      the 300-line feature-component limit. No data fetching here.
//
// `PayMethod`, `resolveActiveMethod`, and the canonical option list now live in
// `@/components/features/shared/payment-method-picker` — the single source of
// truth shared with `record-payment-dialog.tsx`. We re-export them here so
// `step-package.tsx`'s existing imports keep compiling unchanged.

import { HugeiconsIcon } from "@hugeicons/react"
import { Package01Icon } from "@hugeicons/core-free-icons"

import { Button } from "@sawaa/ui"

import { useLocale } from "@/components/locale-provider"
import { FormattedCurrency } from "@/components/features/shared/sar-symbol"
import {
  PaymentMethodPicker,
  resolveActiveMethod,
  type PayMethod,
  type PayMethodSettingKey,
  type PaymentMethodOption,
} from "@/components/features/shared/payment-method-picker"
import { WizardCard } from "@/components/features/bookings/wizard-card"
import type { PaymentSettings } from "@/lib/api/organization-settings"
import type {
  PackageCredit,
  PackagePurchase,
} from "@/lib/types/package-purchase"
import type { SessionPackage } from "@/lib/types/package"

import type { CreditTarget } from "../use-booking-form-state"

export interface PackageCreditPickerProps {
  purchases: PackagePurchase[]
  onPick: (target: CreditTarget, packagePurchaseId: string) => void
  /** Override the empty-state copy. Defaults to a localized fallback. */
  emptyLabelKey?: string
}

// Re-export the shared module so step-package.tsx keeps its existing imports.
export type { PayMethod, PayMethodSettingKey, PaymentMethodOption }
export { resolveActiveMethod }

/** `packages.sell.method.*` namespace, owned by the package-credit flow. */
const PACKAGE_METHOD_LABEL_KEYS: Record<PayMethod, string> = {
  CASH: "packages.sell.method.cash",
  BANK_TRANSFER: "packages.sell.method.bankTransfer",
  MADA: "packages.sell.method.mada",
  TABBY: "packages.sell.method.tabby",
}

interface MethodPickerProps {
  paymentSettings: PaymentSettings | undefined
  method: PayMethod
  onChange: (m: PayMethod) => void
}

/** Namespace-specific wrapper around the shared `PaymentMethodPicker`. */
export function MethodPicker({
  paymentSettings,
  method,
  onChange,
}: MethodPickerProps): JSX.Element {
  const { t } = useLocale()
  return (
    <PaymentMethodPicker
      paymentSettings={paymentSettings}
      method={method}
      onChange={onChange}
      labelKeys={PACKAGE_METHOD_LABEL_KEYS}
      ariaLabel={t("packages.sell.paymentMethod")}
    />
  )
}

/* ─── Pure helpers (exported for the container) ─── */

export function purchaseName(p: PackagePurchase, locale: string): string {
  if (locale === "ar") return p.packageNameAr
  return p.packageNameEn ?? p.packageNameAr
}

export function packageLabel(p: SessionPackage, locale: string): string {
  if (locale === "ar") return p.nameAr
  return p.nameEn ?? p.nameAr
}

/**
 * Filter a purchase's credits: keep `remaining > 0`, dedupe by the
 * `(serviceId, employeeId, durationOptionId)` triple (keep first). Tolerates
 * null fields so flexible (rule/constraint-based) credits survive.
 */
export function filterUsableCredits(credits: PackageCredit[]): PackageCredit[] {
  const seen = new Set<string>()
  return credits.filter((credit) => {
    if (credit.remaining <= 0) return false
    const key = `${credit.serviceId}:${credit.employeeId}:${credit.durationOptionId}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/** Type guard: jumpable iff categoryId resolved AND service/employee still bookable. Flexible credits have null categoryId. */
export function isJumpableCredit(
  credit: PackageCredit,
): credit is PackageCredit & { categoryId: string } {
  return credit.categoryId != null && credit.serviceIsBookable
}

/** Build the `CreditTarget` payload the booking wizard consumes. */
export function buildCreditTarget(
  credit: PackageCredit & { categoryId: string },
): CreditTarget {
  return {
    departmentId: credit.departmentId,
    departmentName: credit.departmentNameAr,
    categoryId: credit.categoryId,
    categoryName: credit.categoryNameAr,
    categoryBookingMode: credit.categoryBookingMode,
    serviceId: credit.serviceId,
    serviceName: credit.serviceNameAr,
    employeeId: credit.employeeId,
    employeeName: credit.employeeNameAr,
    durationOptionId: credit.durationOptionId,
  }
}

interface CatalogCardProps {
  pkg: SessionPackage
  selected: boolean
  onToggle: () => void
  locale: "ar" | "en"
  itemsCountLabel: string
}

export function CatalogCard({
  pkg,
  selected,
  onToggle,
  locale,
  itemsCountLabel,
}: CatalogCardProps): JSX.Element {
  const finalPriceHalalas = Number(pkg.finalPrice) || 0
  return (
    <WizardCard selected={selected} onClick={onToggle} className="px-4 py-3.5">
      <div className="flex items-start gap-3 text-start">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <HugeiconsIcon icon={Package01Icon} size={18} className="text-primary" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">
            {packageLabel(pkg, locale)}
          </span>
          <span className="truncate text-xs text-muted-foreground tabular-nums">
            {itemsCountLabel}
          </span>
          <span className="text-xs font-semibold text-foreground tabular-nums">
            <FormattedCurrency amount={finalPriceHalalas} locale={locale} decimals={2} />
          </span>
        </div>
      </div>
    </WizardCard>
  )
}

/* ─── Picker component ─── */

export function PackageCreditPicker({
  purchases,
  onPick,
  emptyLabelKey,
}: PackageCreditPickerProps): JSX.Element {
  const { t, locale } = useLocale()

  const groups = purchases
    .map((purchase) => ({
      purchase,
      credits: filterUsableCredits(purchase.credits),
    }))
    .filter((g) => g.credits.length > 0)

  if (groups.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        {t(emptyLabelKey ?? "bookings.pos.package.existing.empty")}
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {groups.map(({ purchase, credits }) => (
        <section key={purchase.id} className="flex flex-col gap-2">
          <header className="flex items-center gap-2 text-sm font-medium text-foreground">
            <HugeiconsIcon icon={Package01Icon} size={14} className="shrink-0 text-primary" />
            <span className="truncate">{purchaseName(purchase, locale)}</span>
          </header>
          <div className="flex flex-col gap-2">
            {credits.map((credit) => {
              const jumpable = isJumpableCredit(credit)
              const isFlexible = credit.categoryId == null
              // Flexible credits carry no resolved service label — fall
              // back to the owning purchase's name so the row is never blank.
              const displayName = credit.serviceNameAr || purchaseName(purchase, locale)
              const remainingLabel = t("bookings.pos.package.remaining")
                .replace("{remaining}", String(credit.remaining))
                .replace("{total}", String(credit.totalQuantity))
              return (
                <div
                  key={credit.id}
                  className="flex items-center justify-between gap-3 rounded-lg border bg-surface-solid p-3"
                >
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <p className="truncate text-sm font-medium">{displayName}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {credit.employeeNameAr} · {credit.durationLabelAr}
                    </p>
                    <p className="text-xs tabular-nums text-muted-foreground">
                      {remainingLabel}
                    </p>
                    {isFlexible && (
                      <p className="text-xs text-muted-foreground">
                        {t("bookings.pos.package.flexibleHint")}
                      </p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    disabled={!jumpable}
                    onClick={() => {
                      // Belt-and-suspenders: a disabled button should not
                      // fire onClick, but this guard makes it impossible to
                      // build a CreditTarget for a credit whose categoryId
                      // is null.
                      if (isJumpableCredit(credit)) {
                        onPick(buildCreditTarget(credit), purchase.id)
                      }
                    }}
                  >
                    {jumpable
                      ? t("bookings.pos.package.use")
                      : t("bookings.pos.package.unavailable")}
                  </Button>
                </div>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
