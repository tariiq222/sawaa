"use client"

import { Button } from "@sawaa/ui"
import { useClientPackagePurchases } from "@/hooks/use-package-purchases"
import { useLocale } from "@/components/locale-provider"
import {
  creditAvailabilityReason,
  creditDedupeKey,
  isCreditBookable,
  isGroupedV2Credit,
  isJumpableCredit,
} from "@/lib/package-credit-usability"
import type { PackageCredit } from "@/lib/types/package-purchase"
import type { CreditTarget } from "./use-booking-form-state"

interface Props {
  clientId: string
  /**
   * The purchase id rides along as a second argument (not folded into
   * CreditTarget) because CreditTarget is also used by the plain
   * CLINICS-track credit-badge path, which has no package purchase to
   * report. Without it the wizard could not record `packagePurchaseId` and
   * would submit a PAID booking for a session the client already covered —
   * the exact bug phase 0 fixed for the PINNED-credit picker.
   */
  onUseCredit: (target: CreditTarget, packagePurchaseId: string) => void
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
  const { data: purchases, isLoading, error, refetch } = useClientPackagePurchases(clientId, { status: "ACTIVE" })

  if (isLoading) return null
  if (error) {
    return (
      <div role="alert" className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
        {t("error.server")}
        <Button variant="link" size="sm" onClick={() => void refetch()}>{t("common.retry")}</Button>
      </div>
    )
  }

  // Flatten purchases × credits, drop exhausted, then dedupe using the
  // shared `creditDedupeKey` helper (pinned triple when all three members
  // exist, otherwise `credit.id` — see @/lib/package-credit-usability).
  // Two ACTIVE purchases can hold credits for the same slot; keep the
  // first. The `purchaseName` is captured per-row so the card can fall
  // back to it for flexible credits whose `serviceNameAr` is blank.
  type UsableRow = {
    purchaseId: string
    purchaseName: string
    modelVersion?: string | null
    credit: PackageCredit
  }
  const rows: UsableRow[] = []
  const seen = new Set<string>()
  for (const purchase of purchases ?? []) {
    for (const credit of purchase.credits) {
      const grouped = isGroupedV2Credit(credit, purchase.modelVersion)
      if (credit.remaining <= 0 && !grouped) continue
      const key = creditDedupeKey(credit, purchase.modelVersion)
      if (seen.has(key)) continue
      seen.add(key)
      rows.push({
        purchaseId: purchase.id,
        purchaseName: purchase.packageNameAr,
        modelVersion: purchase.modelVersion,
        credit,
      })
    }
  }

  if (rows.length === 0) return null

  return (
    <div className="mt-3 flex flex-col gap-2 rounded-lg border bg-muted/30 p-3">
      <p className="text-xs font-medium text-muted-foreground">
        {t("packages.credits.availableForClient")}
      </p>
      {rows.map(({ purchaseId, purchaseName, modelVersion, credit }) => {
        const jumpable = isJumpableCredit(credit)
        const grouped = isGroupedV2Credit(credit, modelVersion)
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
        const reason = creditAvailabilityReason(credit)
        const buttonLabel = jumpable
          ? t("packages.credits.use")
          : credit.categoryId == null
            ? t("packages.credits.flexibleUsePackagesTrack")
            : reason
              ? t(`packages.credits.availability.${reason}`)
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
              {grouped && credit.sessionPosition != null && (
                <p className="text-xs text-muted-foreground">
                  {t("packages.credits.session")} {credit.sessionPosition + 1}
                  {credit.groupLabel ? ` · ${credit.groupLabel}` : ""}
                </p>
              )}
              {credit.deliveryTypeSnapshot && (
                <p className="text-xs text-muted-foreground">
                  {t(`packages.credits.delivery.${credit.deliveryTypeSnapshot}`)}
                </p>
              )}
              {reason && (
                <p className="text-xs font-medium text-warning" role="status">
                  {t(`packages.credits.availability.${reason}`)}
                </p>
              )}
            </div>
            <Button
              size="sm"
              disabled={!jumpable || !isCreditBookable(credit)}
              onClick={() => {
                // Belt-and-suspenders: a disabled button should not fire
                // onClick, but this guard makes it impossible to build a
                // CreditTarget from a credit whose categoryId is null —
                // the type narrows categoryId to `string` so no `!`
                // assertion is needed.
                if (isJumpableCredit(credit)) {
                  onUseCredit(
                    {
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
                      creditId: credit.id,
                      deliveryType: credit.deliveryTypeSnapshot ?? undefined,
                    },
                    purchaseId,
                  )
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
