"use client"

import { useMemo } from "react"
import { applyPackageDiscount } from "@/lib/package-price"
import { formatPrice } from "@/lib/money"
import { useLocale } from "@/components/locale-provider"
import type { PackageDiscountType } from "@/lib/types/package"

interface Props {
  subtotal: number
  discountType: PackageDiscountType
  discountValue: number
}

export function PackagePriceSummary({
  subtotal,
  discountType,
  discountValue,
}: Props) {
  const { t } = useLocale()

  const { discountAmount, finalPrice } = useMemo(
    () => applyPackageDiscount(subtotal, discountType, discountValue),
    [subtotal, discountType, discountValue],
  )

  return (
    <div className="rounded-lg border p-4 flex flex-col gap-2 bg-muted/30">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{t("packages.summary.subtotal")}</span>
        <span className="tabular-nums">{formatPrice(subtotal)}</span>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{t("packages.summary.discount")}</span>
        <span className="tabular-nums text-success">-{formatPrice(discountAmount)}</span>
      </div>
      <div className="flex items-center justify-between border-t pt-2 mt-1">
        <span className="font-medium">{t("packages.summary.finalPrice")}</span>
        <span className="tabular-nums font-semibold text-foreground">{formatPrice(finalPrice)}</span>
      </div>
    </div>
  )
}
