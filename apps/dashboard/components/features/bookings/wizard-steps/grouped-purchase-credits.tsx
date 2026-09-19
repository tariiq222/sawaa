"use client"

import { Button } from "@sawaa/ui"

import { useLocale } from "@/components/locale-provider"
import {
  creditAvailabilityReason,
  isJumpableCredit,
} from "@/lib/package-credit-usability"
import type { PackageCredit, PackagePurchase } from "@/lib/types/package-purchase"

export interface GroupedPurchaseCreditsProps {
  purchase: PackagePurchase
  onPick: (credit: PackageCredit) => void
}

export interface GroupedCreditGroup {
  id: string
  credits: PackageCredit[]
}

/** Keep group order from the API and sort sessions only inside each group. */
export function groupCreditsByPurchaseGroup(
  credits: PackageCredit[],
): GroupedCreditGroup[] {
  const groups = new Map<string, GroupedCreditGroup>()
  credits.forEach((credit) => {
    // A malformed V2 row without a group remains visible as its own row.
    const id = credit.purchaseGroupId ?? `ungrouped:${credit.id}`
    const group = groups.get(id)
    if (group) group.credits.push(credit)
    else groups.set(id, { id, credits: [credit] })
  })

  return [...groups.values()].map((group) => ({
    ...group,
    credits: group.credits
      .map((credit, index) => ({ credit, index }))
      .sort((a, b) => {
        if (a.credit.sessionPosition == null && b.credit.sessionPosition == null) return a.index - b.index
        if (a.credit.sessionPosition == null) return 1
        if (b.credit.sessionPosition == null) return -1
        return a.credit.sessionPosition - b.credit.sessionPosition || a.index - b.index
      })
      .map(({ credit }) => credit),
  }))
}

function text(t: (key: string) => string, key: string, values: Record<string, string | number>) {
  return Object.entries(values).reduce(
    (value, [name, replacement]) => value.replace(`{${name}}`, String(replacement)),
    t(key),
  )
}

function localized(
  locale: string,
  arabic: string | null | undefined,
  english: string | null | undefined,
): string {
  const ar = arabic?.trim() ?? ""
  const en = english?.trim() ?? ""
  return locale === "ar" ? ar : en || ar
}

function serviceLabel(credit: PackageCredit, locale: string): string {
  const direct = credit.categoryBookingMode === "DIRECT"
  return (
    localized(
      locale,
      direct ? credit.categoryNameAr : credit.serviceNameAr,
      direct ? credit.categoryNameEn : credit.serviceNameEn,
    ) ||
    localized(locale, credit.serviceNameAr, credit.serviceNameEn) ||
    localized(locale, credit.categoryNameAr, credit.categoryNameEn)
  )
}

function practitionerLabel(credit: PackageCredit, locale: string): string {
  return localized(locale, credit.employeeNameAr, credit.employeeNameEn) || credit.employeeNameSnapshot || ""
}

function remaining(credit: PackageCredit): number {
  const value = Number(credit.remaining)
  return Number.isFinite(value) ? Math.max(0, value) : 0
}

function rowReason(credit: PackageCredit): string | null {
  const reason = creditAvailabilityReason(credit)
  if (reason) return reason
  if (!credit.availability) return "AVAILABILITY_MISSING"
  if (credit.reservedQuantity > 0) return "RESERVED"
  if (credit.usedQuantity >= credit.totalQuantity) return "CONSUMED"
  if (!credit.categoryId || !credit.serviceId || !credit.employeeId || !credit.durationOptionId || !credit.serviceIsBookable) return "NOT_BOOKABLE"
  return credit.availability.bookable ? null : "NOT_BOOKABLE"
}

function GroupedCreditRow({
  credit,
  position,
  showPractitioner,
  hideReason,
  onPick,
}: {
  credit: PackageCredit
  position: number
  showPractitioner: boolean
  hideReason: boolean
  onPick: GroupedPurchaseCreditsProps["onPick"]
}) {
  const { t, locale } = useLocale()
  const bookable = remaining(credit) > 0 && credit.availability?.bookable === true && isJumpableCredit(credit)
  const practitioner = practitionerLabel(credit, locale)
  const durationMinutes = credit.durationMinsSnapshot ?? credit.durationMins
  const durationLabel = localized(locale, credit.durationLabelAr, credit.durationLabelEn)
  const duration = durationMinutes != null
    ? text(t, "packages.grouped.credit.durationMinutes", {
        minutes: new Intl.NumberFormat(locale === "ar" ? "ar-SA" : "en-US").format(durationMinutes),
      })
    : durationLabel || t("packages.grouped.credit.durationUnknown")
  const delivery = credit.deliveryTypeSnapshot === "IN_PERSON" || credit.deliveryTypeSnapshot === "ONLINE"
    ? t(`packages.grouped.credit.delivery.${credit.deliveryTypeSnapshot}`)
    : t("packages.grouped.credit.deliveryUnknown")
  const reason = rowReason(credit)
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/70 bg-surface-solid p-3">
      <div className="min-w-0 flex-1 text-start">
        <p className="text-sm font-medium text-foreground">
          {text(t, "packages.grouped.credit.session", { position })}
        </p>
        <p className="break-words text-xs text-muted-foreground">
          {[duration, delivery, showPractitioner ? practitioner : ""].filter(Boolean).join(" · ")}
        </p>
        {reason && !hideReason && (
          <p className="break-words text-xs font-medium text-warning" role="status">
            {reason === "AVAILABILITY_MISSING"
              ? t("packages.grouped.credit.availabilityMissing")
              : reason === "NOT_BOOKABLE"
                ? t("packages.grouped.credit.notBookable")
                : t(`packages.grouped.credit.availability.${reason}`)}
          </p>
        )}
      </div>
      {bookable && (
        <Button
          type="button"
          size="sm"
          onClick={() => onPick(credit)}
        >
          {t("packages.grouped.credit.book")}
        </Button>
      )}
    </li>
  )
}

function GroupedCreditGroupView({
  group,
  purchase,
  onPick,
}: {
  group: GroupedCreditGroup
  purchase: PackagePurchase
  onPick: GroupedPurchaseCreditsProps["onPick"]
}) {
  const { t, locale } = useLocale()
  const first = group.credits[0]
  if (!first) return null
  const firstPractitioner = practitionerLabel(first, locale)
  const practitionerKey = first.employeeId ?? firstPractitioner
  const samePractitioner = practitionerKey.length > 0 && group.credits.every(
    (credit) => (credit.employeeId ?? practitionerLabel(credit, locale)) === practitionerKey,
  )
  const dependencyIds = new Set(
    group.credits.filter((credit) => remaining(credit) > 0).map((credit) => credit.dependsOnGroupId ?? ""),
  )
  const activeRows = group.credits.filter((credit) => remaining(credit) > 0)
  const sharedDependency = activeRows.length > 0 && activeRows.every(
    (credit) => creditAvailabilityReason(credit) === "DEPENDENCY_INCOMPLETE",
  )
  const dependencyId = dependencyIds.size === 1 ? [...dependencyIds][0] : ""
  const prerequisite = dependencyId
    ? purchase.credits.find((credit) => credit.purchaseGroupId === dependencyId)
    : undefined
  const prerequisiteName = prerequisite ? serviceLabel(prerequisite, locale) : ""
  const groupLock = sharedDependency
    ? prerequisiteName
      ? text(t, "packages.grouped.credit.dependency", { service: prerequisiteName })
      : t("packages.grouped.credit.dependencyGeneric")
    : null

  return (
    <section className="flex flex-col gap-2" data-testid={`package-credit-group-${group.id}`}>
      <header className="flex min-w-0 flex-col gap-0.5 text-start">
        <p className="break-words text-sm font-semibold text-foreground">{serviceLabel(first, locale) || t("packages.grouped.credit.serviceUnknown")}</p>
        {first.groupLabel && <p className="break-words text-xs text-muted-foreground">{first.groupLabel}</p>}
        {samePractitioner && <p className="break-words text-xs text-muted-foreground">{practitionerLabel(first, locale)}</p>}
      </header>
      {groupLock && <p className="break-words text-xs font-medium text-warning" role="status">{groupLock}</p>}
      <ol className="flex flex-col gap-2">
        {group.credits.map((credit, index) => (
          <GroupedCreditRow
            key={credit.id}
            credit={credit}
            position={(credit.sessionPosition ?? index) + 1}
            showPractitioner={!samePractitioner}
            hideReason={sharedDependency && remaining(credit) > 0 && creditAvailabilityReason(credit) === "DEPENDENCY_INCOMPLETE"}
            onPick={onPick}
          />
        ))}
      </ol>
    </section>
  )
}

export function GroupedPurchaseCredits({
  purchase,
  onPick,
}: GroupedPurchaseCreditsProps) {
  const { t, locale } = useLocale()
  const groups = groupCreditsByPurchaseGroup(purchase.credits)
  const remainingCount = purchase.credits.reduce((sum, credit) => sum + remaining(credit), 0)
  const availableCount = purchase.credits.filter(
    (credit) => remaining(credit) > 0 && credit.availability?.bookable === true && isJumpableCredit(credit),
  ).length

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border/70 bg-surface p-3">
      <header className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-start">
        <p className="break-words text-sm font-semibold text-foreground">
          {localized(locale, purchase.packageNameAr, purchase.packageNameEn)}
        </p>
        <p className="break-words text-xs tabular-nums text-muted-foreground">
          {text(t, "packages.grouped.credit.remaining", { remaining: remainingCount })}
          {" · "}
          {text(t, "packages.grouped.credit.availableNow", { count: availableCount })}
        </p>
      </header>
      <div className="flex flex-col gap-4">
        {groups.map((group) => (
          <GroupedCreditGroupView
            key={group.id}
            group={group}
            purchase={purchase}
            onPick={onPick}
          />
        ))}
      </div>
    </section>
  )
}
