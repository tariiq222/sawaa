"use client"

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
 * `remaining = totalQuantity - usedQuantity - reservedQuantity` math for
 * us — a reserved session has a booked appointment that hasn't happened
 * yet, so it isn't available capacity either. This panel
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
import { ShoppingBagAddIcon } from "@hugeicons/core-free-icons"
import { Skeleton } from "@sawaa/ui"

import { useClientPackagePurchases } from "@/hooks/use-package-purchases"
import { useLocale } from "@/components/locale-provider"
import { useOrganizationConfig } from "@/hooks/use-organization-config"
import { useAuth } from "@/components/providers/auth-provider"
import { PurchaseCard } from "@/components/features/clients/client-package-balance-cards"
import { CreditBookDialog } from "@/components/features/clients/credit-book-dialog"
import { TransferCreditDialog } from "@/components/features/clients/transfer-credit-dialog"
import { RefundPackageDialog } from "@/components/features/clients/refund-package-dialog"
import type {
  PackageCredit,
  PackagePurchase,
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
