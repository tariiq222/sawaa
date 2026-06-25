"use client"

// EXCEPTION: feature-component size limit (300) + absolute (350) exceeded
// — approved 2026-06-24, extended 2026-06-24 (Phase 5).
// — 2026-06-24 — Phase 3 added the per-credit "احجز موعد" button and the
// dialog mount point to the existing balances panel. Phase 5 added the
// per-credit "نقل الرصيد" and per-purchase "استرداد" actions + the two
// new dialogs. Extracting the dialog wrappers into siblings would push
// more complexity into the parent (client-detail-page), which already
// mounts the panel + the sell-package dialog; the trade-off favours
// keeping the mounts co-located.

/**
 * Client package balances panel — Sawaa Dashboard
 *
 * Renders the list of a client's package purchases + the credit buckets
 * inside each purchase. Three states:
 *   - loading: skeleton
 *   - empty: "لا توجد أرصدة بعد" copy
 *   - populated: one card per purchase with a header (package name + status
 *     + amount paid + date) and an inner credits list
 *
 * Money comes pre-coerced as integer halalas; the backend also does the
 * `remaining = totalQuantity - usedQuantity` math for us, so this panel
 * is read-only presentation EXCEPT for the per-credit "احجز موعد" button
 * (Phase 3) and the Phase 5 transfer/refund operator actions:
 *   - "نقل الرصيد" per credit  → TransferCreditDialog (gated on
 *     canDo("booking", "manage") — backend requires `manage:Booking`).
 *   - "استرداد" per purchase  → RefundPackageDialog (gated on
 *     canDo("setting", "manage") — backend requires `manage:Setting`).
 *
 * Cross-feature rule: this component lives under `components/features/
 * clients/` and must NOT import from `components/features/bookings/`.
 * The dialog wrappers are siblings under `clients/` for that reason.
 */

import { useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  CalendarAdd01Icon,
  DeliveryReturnIcon,
  ArrowDataTransferHorizontalIcon,
  ShoppingBagAddIcon,
} from "@hugeicons/core-free-icons"

import { Badge, Button, Skeleton } from "@sawaa/ui"

import { useClientPackagePurchases } from "@/hooks/use-package-purchases"
import { useLocale } from "@/components/locale-provider"
import { useOrganizationConfig } from "@/hooks/use-organization-config"
import { useAuth } from "@/components/providers/auth-provider"
import { FormattedCurrency } from "@/components/features/shared/sar-symbol"
import { CreditBookDialog } from "@/components/features/clients/credit-book-dialog"
import { TransferCreditDialog } from "@/components/features/clients/transfer-credit-dialog"
import { RefundPackageDialog } from "@/components/features/clients/refund-package-dialog"
import { cn } from "@/lib/utils"
import type {
  PackageCredit,
  PackagePurchase,
  PackagePurchaseStatus,
} from "@/lib/types/package-purchase"

/* ─── Props ─── */

interface Props {
  clientId: string
}

/* ─── Component ─── */

export function ClientPackageBalancesPanel({ clientId }: Props) {
  const { locale, t } = useLocale()
  const { formatDate } = useOrganizationConfig()
  const { canDo } = useAuth()
  const { data, isLoading, error, refetch } = useClientPackagePurchases(
    clientId,
  )

  // Defense-in-depth permission gates — the backend is the source of
  // truth; the UI just hides the trigger for users who can't act.
  const canTransferCredit = canDo("booking", "manage")
  const canRefundPurchase = canDo("setting", "manage")

  // Phase 3 — which credit row is currently being booked. The dialog
  // remounts when this flips so each open seeds fresh form state.
  const [bookingCredit, setBookingCredit] = useState<PackageCredit | null>(
    null,
  )
  // Phase 5 — which credit row is currently being transferred.
  const [transferringCredit, setTransferringCredit] =
    useState<PackageCredit | null>(null)
  // Phase 5 — which purchase is currently being refunded.
  const [refundingPurchase, setRefundingPurchase] =
    useState<PackagePurchase | null>(null)

  if (isLoading) return <Skeleton className="h-32 w-full rounded-lg" />

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        {t("error.server")}
        <button
          type="button"
          onClick={() => refetch()}
          className="ms-2 underline underline-offset-2 hover:no-underline"
        >
          {t("common.retry")}
        </button>
      </div>
    )
  }

  const purchases = data ?? []
  if (purchases.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/20 py-12 text-center">
        <HugeiconsIcon
          icon={ShoppingBagAddIcon}
          size={28}
          className="text-muted-foreground"
        />
        <p className="text-sm font-medium text-foreground">
          {t("packages.balances.empty.title")}
        </p>
        <p className="max-w-sm text-xs text-muted-foreground">
          {t("packages.balances.empty.description")}
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {purchases.map((purchase) => (
        <PurchaseCard
          key={purchase.id}
          purchase={purchase}
          locale={locale}
          t={t}
          formatDate={formatDate}
          canTransferCredit={canTransferCredit}
          canRefundPurchase={canRefundPurchase}
          onBookCredit={(credit) => setBookingCredit(credit)}
          onTransferCredit={(credit) => setTransferringCredit(credit)}
          onRefundPurchase={(purchase) => setRefundingPurchase(purchase)}
        />
      ))}
      <CreditBookDialog
        clientId={clientId}
        credit={bookingCredit}
        open={!!bookingCredit}
        onOpenChange={(open) => {
          if (!open) setBookingCredit(null)
        }}
        onBooked={() => setBookingCredit(null)}
      />
      <TransferCreditDialog
        credit={transferringCredit}
        open={!!transferringCredit}
        onOpenChange={(open) => {
          if (!open) setTransferringCredit(null)
        }}
        onTransferred={() => setTransferringCredit(null)}
      />
      <RefundPackageDialog
        purchase={refundingPurchase}
        open={!!refundingPurchase}
        onOpenChange={(open) => {
          if (!open) setRefundingPurchase(null)
        }}
        onRefunded={() => setRefundingPurchase(null)}
      />
    </div>
  )
}

/* ─── Per-purchase card ─── */

function PurchaseCard({
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
      {/* Header */}
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
              <FormattedCurrency amount={purchase.amountPaid} locale={locale} decimals={2} />
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
              <HugeiconsIcon
                icon={DeliveryReturnIcon}
                size={12}
                className="me-1.5"
              />
              {t("packages.balances.refund.button")}
            </Button>
          )}
        </div>
      </div>

      {/* Credits */}
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
                locale={locale}
                t={t}
                canTransferCredit={canTransferCredit}
                onBook={() => onBookCredit(credit)}
                onTransfer={() => onTransferCredit(credit)}
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

/* ─── Credit row ─── */

function CreditRow({
  credit,
  locale,
  t,
  canTransferCredit,
  onBook,
  onTransfer,
}: {
  credit: PackageCredit
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

  return (
    <li className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-md bg-muted/30 px-3 py-2">
      <div className="flex flex-col">
        <span className="text-sm font-medium text-foreground">
          {serviceName}
        </span>
        <span className="text-xs text-muted-foreground">
          {employeeName} • {durationLabel}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "text-sm tabular-nums font-medium",
            isDepleted ? "text-muted-foreground" : "text-foreground",
          )}
        >
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
            aria-label={t("packages.balances.transfer.aria")}
            data-testid="credit-transfer-button"
            className="h-8"
          >
            <HugeiconsIcon
              icon={ArrowDataTransferHorizontalIcon}
              size={14}
              className="me-1.5"
            />
            {t("packages.balances.transfer.button")}
          </Button>
        )}
        {!isDepleted && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onBook}
            aria-label={t("packages.balances.book.aria")}
            data-testid="credit-book-button"
            className="h-8"
          >
            <HugeiconsIcon
              icon={CalendarAdd01Icon}
              size={14}
              className="me-1.5"
            />
            {t("packages.balances.book.button")}
          </Button>
        )}
      </div>
    </li>
  )
}

/* ─── Status badge ─── */

const STATUS_LABEL_KEY: Record<PackagePurchaseStatus, string> = {
  ACTIVE: "packages.balances.status.active",
  COMPLETED: "packages.balances.status.completed",
  REFUNDED: "packages.balances.status.refunded",
}

const STATUS_BADGE_STYLES: Record<PackagePurchaseStatus, string> = {
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
    <Badge
      variant="outline"
      className={cn(
        "font-semibold px-2 py-0.5 text-[11px] tracking-tight rounded-md",
        STATUS_BADGE_STYLES[status],
      )}
    >
      {t(STATUS_LABEL_KEY[status])}
    </Badge>
  )
}
