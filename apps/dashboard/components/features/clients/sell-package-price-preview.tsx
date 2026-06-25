"use client"

/**
 * Server-computed price preview for the sell-package dialog.
 *
 * Reads the frozen prices that the backend has already calculated for the
 * selected `SessionPackage` (subtotal / discountAmount / finalPrice) and
 * re-derives the discount for display. We deliberately do NOT recompute
 * the unit price on the client (per-employee override + duration pricing
 * live in the backend's `ComputePackagePriceService`); the preview just
 * renders the numbers the catalog endpoint already returned.
 */

import { Label } from "@sawaa/ui"

import { FormattedCurrency } from "@/components/features/shared/sar-symbol"
import { useLocale } from "@/components/locale-provider"
import { applyPackageDiscount } from "@/lib/package-price"
import type { SessionPackage } from "@/lib/types/package"

interface Props {
  pkg: SessionPackage | undefined
}

export function SellPackagePricePreview({ pkg }: Props) {
  const { locale, t } = useLocale()
  if (!pkg) return null

  const subtotal = Number(pkg.subtotal) || 0
  const discountValue = Number(pkg.discountValue) || 0
  const { discountAmount, finalPrice } = applyPackageDiscount(
    subtotal,
    pkg.discountType,
    discountValue,
  )

  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-3">
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">
        {t("packages.sell.frozenPrice")}
      </Label>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {t("packages.sell.price.subtotal")}
        </span>
        <span className="tabular-nums">
          <FormattedCurrency amount={subtotal} locale={locale} decimals={2} />
        </span>
      </div>
      {discountAmount > 0 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {t("packages.sell.price.discount")}
          </span>
          <span className="tabular-nums text-success">
            -
            <FormattedCurrency amount={discountAmount} locale={locale} decimals={2} />
          </span>
        </div>
      )}
      <div className="flex items-center justify-between border-t pt-1.5 mt-0.5">
        <span className="text-sm font-medium">
          {t("packages.sell.price.total")}
        </span>
        <span className="tabular-nums text-base font-semibold text-foreground">
          <FormattedCurrency amount={finalPrice} locale={locale} decimals={2} />
        </span>
      </div>
    </div>
  )
}