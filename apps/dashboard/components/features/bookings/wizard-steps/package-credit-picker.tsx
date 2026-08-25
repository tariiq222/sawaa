"use client"

// Phase 6 — wizard-step presentational + BUY-mode UI helpers.
// `PackageCreditPicker` is the EXISTING-mode render layer; `MethodPicker`
// and `CatalogCard` are BUY-mode helpers co-located so step-package.tsx
// can import them from one path. No data fetching here.

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
import type { PackageCredit, PackagePurchase } from "@/lib/types/package-purchase"
import type { SessionPackage } from "@/lib/types/package"
import { filterUsableCredits, isJumpableCredit } from "@/lib/package-credit-usability"

import type { CreditTarget } from "../use-booking-form-state"

export interface PackageCreditPickerProps {
  purchases: PackagePurchase[]
  onPick: (target: CreditTarget, packagePurchaseId: string) => void
  /** Optional — when absent the flexible branch renders disabled. The
   *  PACKAGES-track caller wires this to `applyCreditFilter`, so a
   *  flexible credit narrows the wizard's option lists to what the
   *  credit's constraints permit. */
  onPickFlexible?: (
    credit: PackageCredit,
    packagePurchaseId: string,
    packageName: string,
  ) => void
  /** Override the empty-state copy. Defaults to a localized fallback. */
  emptyLabelKey?: string
}

// Re-exported so step-package.tsx's existing imports keep compiling.
export type { PayMethod, PayMethodSettingKey, PaymentMethodOption }
export { resolveActiveMethod }

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

export function purchaseName(p: PackagePurchase, locale: string): string {
  if (locale === "ar") return p.packageNameAr
  return p.packageNameEn ?? p.packageNameAr
}

export function packageLabel(p: SessionPackage, locale: string): string {
  if (locale === "ar") return p.nameAr
  return p.nameEn ?? p.nameAr
}

/** Build the wizard's `CreditTarget` from a narrowed jumpable credit. */
export function buildCreditTarget(
  credit: PackageCredit & {
    categoryId: string; serviceId: string; employeeId: string; durationOptionId: string
  },
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

interface CreditRowProps {
  credit: PackageCredit
  purchase: PackagePurchase
  onPick: (target: CreditTarget, packagePurchaseId: string) => void
  onPickFlexible?: (credit: PackageCredit, packagePurchaseId: string, packageName: string) => void
}

/* Extracted from `PackageCreditPicker` to keep the container under the
 * 300-line cap. Three branches: jumpable -> flexible (ENABLED only when
 * wired) -> pinned-but-inactive. Subtitle suppressed when both parts
 * are blank to avoid a dangling `·`. */
function CreditRow({
  credit,
  purchase,
  onPick,
  onPickFlexible,
}: CreditRowProps): JSX.Element {
  const { t, locale } = useLocale()
  const jumpable = isJumpableCredit(credit)
  const isFlexible = !jumpable && credit.categoryId == null
  const isPinnedNotBookable = !jumpable && credit.categoryId != null
  const displayName = credit.serviceNameAr || purchaseName(purchase, locale)
  const remainingLabel = t("bookings.pos.package.remaining")
    .replace("{remaining}", String(credit.remaining))
    .replace("{total}", String(credit.totalQuantity))
  const subtitleParts = [credit.employeeNameAr, credit.durationLabelAr].filter(
    (part) => part.length > 0,
  )
  const subtitleText = subtitleParts.join(" · ")
  return (
    <div
      key={credit.id}
      className="flex items-center justify-between gap-3 rounded-lg border bg-surface-solid p-3"
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="truncate text-sm font-medium">{displayName}</p>
        {subtitleText.length > 0 && (
          <p className="truncate text-xs text-muted-foreground">{subtitleText}</p>
        )}
        <p className="text-xs tabular-nums text-muted-foreground">{remainingLabel}</p>
        {isFlexible && (
          <>
            <p className="text-xs font-medium text-foreground">
              {t("bookings.pos.package.flexibleTitle")}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("bookings.pos.package.flexibleSubtitle")}
            </p>
          </>
        )}
      </div>
      <Button
        size="sm"
        disabled={isPinnedNotBookable || (isFlexible && !onPickFlexible)}
        onClick={() => {
          // Disabled buttons shouldn't fire onClick; each branch below
          // re-narrows the credit so no `!` is needed in the bodies.
          if (jumpable) {
            onPick(buildCreditTarget(credit), purchase.id)
            return
          }
          if (isFlexible && onPickFlexible) {
            onPickFlexible(credit, purchase.id, purchaseName(purchase, locale))
          }
        }}
      >
        {jumpable
          ? t("bookings.pos.package.use")
          : isFlexible
            ? t("bookings.pos.package.chooseFromPackage")
            : t("bookings.pos.package.notBookable")}
      </Button>
    </div>
  )
}

export function PackageCreditPicker({
  purchases,
  onPick,
  onPickFlexible,
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
            {credits.map((credit) => (
              <CreditRow
                key={credit.id}
                credit={credit}
                purchase={purchase}
                onPick={onPick}
                onPickFlexible={onPickFlexible}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
