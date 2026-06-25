"use client"

import { Button } from "@sawaa/ui"
import { useClientPackagePurchases } from "@/hooks/use-package-purchases"
import { useLocale } from "@/components/locale-provider"
import type { CreditTarget } from "./use-booking-form-state"

interface Props {
  clientId: string
  onUseCredit: (target: CreditTarget) => void
}

/**
 * Displays a client's active package credits that are still usable
 * (remaining > 0). Each usable credit shows a "Use package credit" button
 * that fires `onUseCredit` with a fully-resolved `CreditTarget` so the
 * booking wizard can jump directly to the correct service/employee/duration.
 *
 * Renders nothing when the client has no usable credits.
 */
export function ClientCreditsPanel({ clientId, onUseCredit }: Props) {
  const { t } = useLocale()
  const { data: purchases, isLoading } = useClientPackagePurchases(clientId, { status: "ACTIVE" })

  if (isLoading) return null

  // Flatten, filter by remaining > 0, then dedupe by the credit triple
  // (serviceId:employeeId:durationOptionId). Two ACTIVE purchases can hold
  // credits for the same slot; keep only the first (highest-remaining by
  // API order). key={credit.id} still uniquely identifies the card.
  const usable = (() => {
    const seen = new Set<string>()
    return (purchases ?? [])
      .flatMap((p) =>
        p.credits.map((c) => ({ purchaseName: p.packageNameAr, credit: c })),
      )
      .filter((x) => {
        if (x.credit.remaining <= 0) return false
        const key = `${x.credit.serviceId}:${x.credit.employeeId}:${x.credit.durationOptionId}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
  })()

  if (usable.length === 0) return null

  return (
    <div className="mt-3 flex flex-col gap-2 rounded-lg border bg-muted/30 p-3">
      <p className="text-xs font-medium text-muted-foreground">
        {t("packages.credits.availableForClient")}
      </p>
      {usable.map(({ purchaseName, credit }) => {
        const bookable = credit.serviceIsBookable
        return (
          <div
            key={credit.id}
            className="flex items-center justify-between rounded-md border bg-surface-solid p-2.5"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{credit.serviceNameAr}</p>
              <p className="truncate text-xs text-muted-foreground">
                {purchaseName} · {credit.employeeNameAr} · {credit.durationLabelAr}
              </p>
              <p className="text-xs tabular-nums text-muted-foreground">
                {t("packages.credits.remaining")}: {credit.remaining} / {credit.totalQuantity}
              </p>
            </div>
            <Button
              size="sm"
              disabled={!bookable}
              onClick={() =>
                onUseCredit({
                  departmentId: credit.departmentId,
                  departmentName: credit.departmentNameAr,
                  categoryId: credit.categoryId!,
                  categoryName: credit.categoryNameAr,
                  categoryBookingMode: credit.categoryBookingMode,
                  serviceId: credit.serviceId,
                  serviceName: credit.serviceNameAr,
                  employeeId: credit.employeeId,
                  employeeName: credit.employeeNameAr,
                  durationOptionId: credit.durationOptionId,
                })
              }
            >
              {bookable
                ? t("packages.credits.use")
                : t("packages.credits.unavailable")}
            </Button>
          </div>
        )
      })}
    </div>
  )
}
