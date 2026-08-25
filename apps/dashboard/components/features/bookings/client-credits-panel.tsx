"use client"

import { Button } from "@sawaa/ui"
import { useClientPackagePurchases } from "@/hooks/use-package-purchases"
import { useLocale } from "@/components/locale-provider"
import { creditDedupeKey, isJumpableCredit } from "@/lib/package-credit-usability"
import type { PackageCredit } from "@/lib/types/package-purchase"
import type { CreditTarget } from "./use-booking-form-state"

interface Props {
  clientId: string
  onUseCredit: (target: CreditTarget) => void
}

/**
 * Displays a client's active package credits that are still usable
 * (remaining > 0). This panel is JUMP-ONLY by design — a jumpable credit
 * fires `onUseCredit` with a fully-resolved `CreditTarget` so the booking
 * wizard can jump directly to the correct service/employee/duration.
 *
 * Non-jumpable credits render a disabled button. FLEXIBLE / rule-based
 * credits (no resolved `categoryId`) cannot be spent from this panel —
 * the panel cannot switch tracks or apply a restriction, so the
 * restricted flow that spends a flexible credit lives in the PACKAGES
 * track picker. The label copy therefore points the operator there
 * rather than promising a dead "deduct from package" action. Pinned-
 * but-inactive credits (archived service/employee) surface an explicit
 * "not bookable" message.
 *
 * Renders nothing when the client has no usable credits or while loading.
 */
export function ClientCreditsPanel({ clientId, onUseCredit }: Props) {
  const { t } = useLocale()
  const { data: purchases, isLoading } = useClientPackagePurchases(clientId, { status: "ACTIVE" })

  if (isLoading) return null

  // Flatten purchases × credits, drop exhausted, then dedupe using the
  // shared `creditDedupeKey` helper (pinned triple when all three members
  // exist, otherwise `credit.id` — see @/lib/package-credit-usability).
  // Two ACTIVE purchases can hold credits for the same slot; keep the
  // first. The `purchaseName` is captured per-row so the card can fall
  // back to it for flexible credits whose `serviceNameAr` is blank.
  type UsableRow = { purchaseName: string; credit: PackageCredit }
  const rows: UsableRow[] = []
  const seen = new Set<string>()
  for (const purchase of purchases ?? []) {
    for (const credit of purchase.credits) {
      if (credit.remaining <= 0) continue
      const key = creditDedupeKey(credit)
      if (seen.has(key)) continue
      seen.add(key)
      rows.push({ purchaseName: purchase.packageNameAr, credit })
    }
  }

  if (rows.length === 0) return null

  return (
    <div className="mt-3 flex flex-col gap-2 rounded-lg border bg-muted/30 p-3">
      <p className="text-xs font-medium text-muted-foreground">
        {t("packages.credits.availableForClient")}
      </p>
      {rows.map(({ purchaseName, credit }) => {
        const jumpable = isJumpableCredit(credit)
        // Flexible credits carry no resolved service label — fall back to
        // the owning purchase's name so the title is never blank.
        const titleText = credit.serviceNameAr || purchaseName
        // Subtitle: `·`-joined non-empty parts only, so no dangling
        // separators render when employeeNameAr / durationLabelAr are
        // empty on a flexible credit.
        const subtitleParts = [
          purchaseName,
          credit.employeeNameAr,
          credit.durationLabelAr,
        ].filter((part) => part.length > 0)
        const subtitleText = subtitleParts.join(" · ")
        // Label precedence: flexible → point operator to the PACKAGES
        // track (this panel cannot spend a flexible credit); inactive
        // service/employee → "not bookable"; jumpable → "use".
        const buttonLabel = jumpable
          ? t("packages.credits.use")
          : credit.categoryId == null
            ? t("packages.credits.flexibleUsePackagesTrack")
            : t("packages.credits.notBookable")
        return (
          <div
            key={credit.id}
            className="flex items-center justify-between rounded-md border bg-surface-solid p-2.5"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{titleText}</p>
              <p className="truncate text-xs text-muted-foreground">
                {subtitleText}
              </p>
              <p className="text-xs tabular-nums text-muted-foreground">
                {t("packages.credits.remaining")}: {credit.remaining} / {credit.totalQuantity}
              </p>
            </div>
            <Button
              size="sm"
              disabled={!jumpable}
              onClick={() => {
                // Belt-and-suspenders: a disabled button should not fire
                // onClick, but this guard makes it impossible to build a
                // CreditTarget from a credit whose categoryId is null —
                // the type narrows categoryId to `string` so no `!`
                // assertion is needed.
                if (isJumpableCredit(credit)) {
                  onUseCredit({
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
                  })
                }
              }}
            >
              {buttonLabel}
            </Button>
          </div>
        )
      })}
    </div>
  )
}