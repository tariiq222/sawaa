"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import {
  CalendarAdd01Icon,
  DeliveryReturnIcon,
  ArrowDataTransferHorizontalIcon,
} from "@hugeicons/core-free-icons"
import { Badge, Button } from "@sawaa/ui"
import { FormattedCurrency } from "@/components/features/shared/sar-symbol"
import { cn } from "@/lib/utils"
import {
  creditAvailabilityReason,
  isCreditBookable,
  isGroupedV2Credit,
} from "@/lib/package-credit-usability"
import type {
  PackageCredit,
  PackagePurchase,
  PackagePurchaseStatus,
} from "@/lib/types/package-purchase"

export function PurchaseCard({
  purchase,
  locale,
  t,
  formatDate,
  canTransferCredit,
  canRefundPurchase,
  onBookCredit,
  onTransferCredit,
  onRefundPurchase,
}: {
  purchase: PackagePurchase
  locale: "ar" | "en"
  t: (key: string) => string
  formatDate: (d: string) => string
  canTransferCredit: boolean
  canRefundPurchase: boolean
  onBookCredit: (credit: PackageCredit) => void
  onTransferCredit: (credit: PackageCredit) => void
  onRefundPurchase: (purchase: PackagePurchase) => void
}) {
  const packageName =
    locale === "ar"
      ? purchase.packageNameAr
      : (purchase.packageNameEn ?? purchase.packageNameAr)
  const isRefunded = purchase.status === "REFUNDED"

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">
              {packageName}
            </span>
            <PurchaseStatusBadge status={purchase.status} t={t} />
          </div>
          <span className="text-xs text-muted-foreground tabular-nums" dir="ltr">
            {formatDate(purchase.paidAt)}
          </span>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex flex-col items-end gap-0.5">
            <span className="text-xs text-muted-foreground">
              {t("packages.balances.col.amount")}
            </span>
            <span className="text-sm font-semibold tabular-nums">
              <FormattedCurrency amount={purchase.totalCharged ?? purchase.amountPaid} locale={locale} decimals={2} />
            </span>
            {isRefunded && purchase.refundAmount > 0 && (
              <span className="text-xs text-muted-foreground">
                {t("packages.balances.refundAmount")}: {" "}
                <span className="tabular-nums text-error">
                  <FormattedCurrency amount={purchase.refundAmount} locale={locale} decimals={2} />
                </span>
              </span>
            )}
          </div>
          {canRefundPurchase && !isRefunded && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => onRefundPurchase(purchase)}
              aria-label={t("packages.balances.refund.aria")}
              data-testid="package-refund-button"
              className="h-7 text-xs text-error hover:bg-error/10 hover:text-error"
            >
              <HugeiconsIcon icon={DeliveryReturnIcon} size={12} className="me-1.5" />
              {t("packages.balances.refund.button")}
            </Button>
          )}
        </div>
      </div>

      {purchase.credits.length > 0 && (
        <div className="flex flex-col gap-1.5 border-t pt-3">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t("packages.balances.col.credits")}
          </span>
          <ul className="flex flex-col gap-1.5">
            {purchase.credits.map((credit) => (
              <CreditRow
                key={credit.id}
                credit={credit}
                modelVersion={purchase.modelVersion}
                locale={locale}
                t={t}
                canTransferCredit={canTransferCredit}
                onBook={() => onBookCredit(credit)}
                onTransfer={() => onTransferCredit({ ...credit, modelVersion: purchase.modelVersion })}
              />
            ))}
          </ul>
        </div>
      )}

      {purchase.notes && (
        <p className="border-t pt-2 text-xs text-muted-foreground">
          {purchase.notes}
        </p>
      )}
    </div>
  )
}

function CreditRow({
  credit,
  modelVersion,
  locale,
  t,
  canTransferCredit,
  onBook,
  onTransfer,
}: {
  credit: PackageCredit
  modelVersion?: string | null
  locale: "ar" | "en"
  t: (key: string) => string
  canTransferCredit: boolean
  onBook: () => void
  onTransfer: () => void
}) {
  const serviceName =
    locale === "ar"
      ? credit.serviceNameAr
      : (credit.serviceNameEn ?? credit.serviceNameAr)
  const employeeName =
    locale === "ar"
      ? credit.employeeNameAr
      : (credit.employeeNameEn ?? credit.employeeNameAr)
  const durationLabel =
    locale === "ar"
      ? credit.durationLabelAr
      : (credit.durationLabelEn ?? credit.durationLabelAr)
  const isDepleted = credit.remaining <= 0
  const grouped = isGroupedV2Credit(credit, modelVersion)
  const availabilityReason = creditAvailabilityReason(credit)
  const canBook = credit.remaining > 0 && isCreditBookable(credit)
  const canTransfer = credit.reservedQuantity === 0 && (!grouped || credit.usedQuantity === 0)

  return (
    <li className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-md bg-muted/30 px-3 py-2">
      <div className="flex flex-col">
        <span className="text-sm font-medium text-foreground">{serviceName}</span>
        <span className="text-xs text-muted-foreground">
          {employeeName} • {durationLabel}
        </span>
        {(grouped || credit.deliveryTypeSnapshot) && (
          <span className="text-xs text-muted-foreground">
            {grouped && credit.sessionPosition != null
              ? `${t("packages.credits.session")} ${credit.sessionPosition + 1}`
              : null}
            {grouped && credit.groupLabel ? ` · ${credit.groupLabel}` : ""}
            {credit.deliveryTypeSnapshot
              ? ` · ${t(`packages.credits.delivery.${credit.deliveryTypeSnapshot}`)}`
              : ""}
          </span>
        )}
        {availabilityReason && (
          <span className="text-xs font-medium text-warning">
            {t(`packages.credits.availability.${availabilityReason}`)}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className={cn("text-sm tabular-nums font-medium", isDepleted ? "text-muted-foreground" : "text-foreground")}>
          {credit.remaining}
          <span className="ms-1 text-xs font-normal text-muted-foreground">
            / {credit.totalQuantity} {t("packages.balances.credit.remaining")}
          </span>
        </span>
        {canTransferCredit && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={onTransfer}
            disabled={!canTransfer}
            aria-label={t("packages.balances.transfer.aria")}
            data-testid="credit-transfer-button"
            className="h-8"
          >
            <HugeiconsIcon icon={ArrowDataTransferHorizontalIcon} size={14} className="me-1.5" />
            {t("packages.balances.transfer.button")}
          </Button>
        )}
        {canBook && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onBook}
            aria-label={t("packages.balances.book.aria")}
            data-testid="credit-book-button"
            className="h-8"
          >
            <HugeiconsIcon icon={CalendarAdd01Icon} size={14} className="me-1.5" />
            {t("packages.balances.book.button")}
          </Button>
        )}
      </div>
    </li>
  )
}

const STATUS_LABEL_KEY: Record<PackagePurchaseStatus, string> = {
  PENDING: "packages.balances.status.pending",
  ACTIVE: "packages.balances.status.active",
  COMPLETED: "packages.balances.status.completed",
  REFUNDED: "packages.balances.status.refunded",
}

const STATUS_BADGE_STYLES: Record<PackagePurchaseStatus, string> = {
  PENDING: "border-warning/30 bg-warning/10 text-warning",
  ACTIVE: "border-success/30 bg-success/10 text-success",
  COMPLETED: "border-muted-foreground/30 bg-muted text-muted-foreground",
  REFUNDED: "border-error/30 bg-error/10 text-error",
}

function PurchaseStatusBadge({
  status,
  t,
}: {
  status: PackagePurchaseStatus
  t: (key: string) => string
}) {
  return (
    <Badge variant="outline" className={cn("font-semibold px-2 py-0.5 text-[11px] tracking-tight rounded-md", STATUS_BADGE_STYLES[status])}>
      {t(STATUS_LABEL_KEY[status])}
    </Badge>
  )
}
