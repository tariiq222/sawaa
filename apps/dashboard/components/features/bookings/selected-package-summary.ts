import type { CreditFilter } from "@/lib/booking-credit-filter"
import type { Locale } from "@/lib/translations"
import type { PackageCredit, PackagePurchase } from "@/lib/types/package-purchase"

export interface SelectedPackageSummary {
  packageName: string
  sessionPosition: number | null
  serviceName: string | null
  remaining: number | null
}

function localizedPackageName(purchase: PackagePurchase, locale: Locale): string | null {
  const arabic = purchase.packageNameAr.trim()
  const english = purchase.packageNameEn?.trim() ?? ""
  const name = locale === "ar" ? arabic || english : english || arabic
  return name || null
}

function localizedServiceName(credit: PackageCredit, locale: Locale): string | null {
  const arabic = credit.categoryBookingMode === "DIRECT"
    ? credit.categoryNameAr.trim()
    : credit.serviceNameAr.trim()
  const english = credit.categoryBookingMode === "DIRECT"
    ? credit.categoryNameEn?.trim() ?? ""
    : credit.serviceNameEn?.trim() ?? ""
  const snapshot = credit.serviceNameSnapshot?.trim() ?? ""
  const name = locale === "ar" ? arabic || snapshot || english : english || arabic || snapshot
  return name || null
}

function purchaseRemaining(purchase: PackagePurchase): number | null {
  const values = purchase.credits
    .map((credit) => credit.remaining)
    .filter((remaining) => Number.isFinite(remaining))
  return values.length > 0
    ? values.reduce((sum, remaining) => sum + Math.max(0, remaining), 0)
    : null
}

/** Resolve current package and credit metadata from the active client query. */
export function resolveSelectedPackageSummary({
  clientId,
  packagePurchaseId,
  packageCreditId,
  creditFilter,
  purchases,
  locale,
}: {
  clientId: string | null
  packagePurchaseId: string | null
  packageCreditId: string | null
  creditFilter: CreditFilter | null
  purchases: PackagePurchase[] | undefined
  locale: Locale
}): SelectedPackageSummary | null {
  const purchaseId = packagePurchaseId ?? creditFilter?.packagePurchaseId ?? null
  const creditId = packageCreditId ?? creditFilter?.creditId ?? null
  if (!clientId || (!purchaseId && !creditId)) return null

  const purchase = purchaseId
    ? purchases?.find((candidate) => candidate.id === purchaseId)
    : purchases?.find((candidate) => candidate.credits.some((credit) => credit.id === creditId))
  const fallbackName =
    creditFilter && creditFilter.packagePurchaseId === purchaseId
      ? creditFilter.packageName.trim() || null
      : null

  // The flexible filter is the only legacy state allowed to provide a name
  // while the purchase request is loading or a legacy row lacks metadata.
  if (!purchase) {
    return fallbackName
      ? { packageName: fallbackName, sessionPosition: null, serviceName: null, remaining: null }
      : null
  }

  const packageName = localizedPackageName(purchase, locale) ?? fallbackName
  if (!packageName) return null

  if (!creditId) {
    return { packageName, sessionPosition: null, serviceName: null, remaining: purchaseRemaining(purchase) }
  }

  const credit = purchase.credits.find((candidate) => candidate.id === creditId)
  // Both IDs are meaningful when present. Reject a stale credit from another
  // purchase during a client or selection reset.
  if (!credit) return null

  return {
    packageName,
    sessionPosition: credit.sessionPosition ?? null,
    serviceName: localizedServiceName(credit, locale),
    remaining: purchaseRemaining(purchase),
  }
}
