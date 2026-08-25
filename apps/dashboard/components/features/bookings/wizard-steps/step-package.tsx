"use client"

// Phase 6 — PACKAGES-track wizard step (container).
//   • EXISTING mode — surfaces the client's active package balances and
//     emits a `CreditTarget` to the parent wizard on selection.
//   • BUY mode — sells a new SessionPackage at the desk and forces the
//     operator to explicitly pick which item the first session consumes.
// Post-purchase refetch: the sell mutation's response carries a `credits[]`
// payload that lacks the resolved categoryId/departmentId, so we await the
// invalidated list query before switching to EXISTING mode.

import { useEffect, useMemo, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { HugeiconsIcon } from "@hugeicons/react"
import { Package01Icon } from "@hugeicons/core-free-icons"
import { toast } from "sonner"

import { Button } from "@sawaa/ui"

import { useLocale } from "@/components/locale-provider"
import {
  useClientPackagePurchases,
  useSellPackage,
} from "@/hooks/use-package-purchases"
import { usePackagesList } from "@/hooks/use-packages"
import { usePaymentSettings } from "@/hooks/use-organization-settings"
import { queryKeys } from "@/lib/query-keys"
import { showApiError } from "@/lib/mutation-helpers"
import { buildCreditFilter, type CreditFilter } from "@/lib/booking-credit-filter"

import type {
  CreatePackagePurchasePayload,
  PackageCredit,
  PackagePurchasePaymentMethod,
} from "@/lib/types/package-purchase"
import type { SessionPackage } from "@/lib/types/package"

import type { CreditTarget } from "../use-booking-form-state"
import {
  CatalogCard,
  MethodPicker,
  PackageCreditPicker,
  resolveActiveMethod,
  type PayMethod,
} from "./package-credit-picker"

/* ─── Skeleton ─── */

function StepPackageSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={`step-package-skel-${i}`}
          className="h-16 animate-pulse rounded-2xl bg-muted"
        />
      ))}
    </div>
  )
}

interface StepPackageProps {
  clientId: string
  branchId: string
  onCreditSelected: (target: CreditTarget, packagePurchaseId: string) => void
  /** Fired when the operator spends a FLEXIBLE credit. The wizard cannot
   *  jump-fill from it, so the shell records the restriction and lets the
   *  operator pick within the credit's allowed options. Absent in surfaces
   *  that do not support the restricted flow — the picker then renders the
   *  flexible branch disabled. */
  onFlexibleCreditSelected?: (filter: CreditFilter) => void
}

type UiMode = "EXISTING" | "BUY"

export function StepPackage({
  clientId,
  branchId,
  onCreditSelected,
  onFlexibleCreditSelected,
}: StepPackageProps): JSX.Element {
  const { t, locale } = useLocale()
  const queryClient = useQueryClient()

  const { data: purchases, isLoading: purchasesLoading } =
    useClientPackagePurchases(clientId, { status: "ACTIVE" })
  const { packages, isLoading: packagesLoading } = usePackagesList()
  const { data: paymentSettings } = usePaymentSettings()
  const sellMut = useSellPackage()

  // True if ANY active credit has remaining > 0 — counts flexible credits
  // (categoryId === null) too, so the step opens in EXISTING mode for
  // clients who only hold rule-based packages. Otherwise the operator is
  // invited to sell a duplicate.
  const hasUsableCredits = useMemo(
    () =>
      (purchases ?? []).some((purchase) =>
        purchase.credits.some((credit) => credit.remaining > 0),
      ),
    [purchases],
  )

  const [mode, setMode] = useState<UiMode>("BUY")
  // Latches once the operator manually toggles to BUY so the initial
  // auto-pick never fights them later (e.g. after a successful purchase).
  const [userToggled, setUserToggled] = useState(false)
  // True after a successful purchase so the EXISTING heading reads
  // "pick the first session" instead of the default title.
  const [awaitingFirstSession, setAwaitingFirstSession] = useState(false)
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null)
  const [method, setMethod] = useState<PayMethod>("CASH")

  // Synchronous lock around the sell mutation. `disabled` on the button only
  // catches clicks after React re-renders, so a double-tap before the next
  // paint would otherwise issue two full-amount POSTs (the endpoint has no
  // idempotency key and intentionally allows duplicates).
  const purchaseLockRef = useRef(false)

  // Resolved method is the single source of truth for BOTH the chip
  // highlighted in MethodPicker AND the `method` field posted below. Without
  // this the operator could send CASH while the picker highlights MADA.
  const activeMethod = resolveActiveMethod(paymentSettings, method)

  // Sellable = active and not archived. List endpoint drops archived rows.
  const sellablePackages = useMemo<SessionPackage[]>(
    () => (packages ?? []).filter((p) => p.isActive),
    [packages],
  )

  // Initial mode resolution: snap EXISTING if there's a usable credit,
  // otherwise BUY. Never overrides an explicit operator toggle.
  useEffect(() => {
    if (purchasesLoading || userToggled) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional server → local UI sync
    setMode(hasUsableCredits ? "EXISTING" : "BUY")
  }, [purchasesLoading, hasUsableCredits, userToggled])

  if (
    (purchasesLoading && !purchases) ||
    (mode === "BUY" && packagesLoading && sellablePackages.length === 0)
  ) {
    return <StepPackageSkeleton />
  }

  const selectedPkg = sellablePackages.find((p) => p.id === selectedPackageId)
  const itemsCountLabel = (count: number) =>
    t("bookings.pos.package.itemsCount").replace("{count}", String(count))

  function switchToBuy() {
    setMode("BUY")
    setUserToggled(true)
    setAwaitingFirstSession(false)
  }

  // Convert a flexible-credit pick into a CreditFilter and forward to the
  // shell. Not wrapped in useCallback — the file intentionally avoids the
  // hook (matches the existing style for sibling handlers like switchToBuy
  // and handleConfirmPurchase). The handler is only ever passed to a
  // single child component (PackageCreditPicker), so memoisation would add
  // ceremony without benefit.
  function handlePickFlexible(
    credit: PackageCredit,
    packagePurchaseId: string,
    packageName: string,
  ) {
    onFlexibleCreditSelected?.(
      buildCreditFilter(credit, packagePurchaseId, packageName),
    )
  }

  async function handleConfirmPurchase() {
    if (!selectedPkg) return
    // Sync lock + mutation guard. The lock is released in `finally` so a
    // failed sale can be retried without a remount.
    if (purchaseLockRef.current || sellMut.isPending) return
    purchaseLockRef.current = true
    try {
      const payload: CreatePackagePurchasePayload = {
        packageId: selectedPkg.id,
        clientId,
        branchId,
        method: activeMethod as PackagePurchasePaymentMethod,
      }
      await sellMut.mutateAsync(payload)
      toast.success(t("bookings.pos.package.purchase.success"))
      // Await the explicit refetch: the wire response omits the resolved
      // categoryId/departmentId, so the picker needs the enriched rows.
      await queryClient.refetchQueries({
        queryKey: queryKeys.packagePurchases.byClient(clientId, {
          status: "ACTIVE",
        }),
      })
      setSelectedPackageId(null)
      setAwaitingFirstSession(true)
      setMode("EXISTING")
      setUserToggled(true)
    } catch (err) {
      showApiError(err, {
        fallback: t("bookings.pos.package.purchase.error"),
        t,
      })
    } finally {
      purchaseLockRef.current = false
    }
  }

  /* ─── Render: EXISTING mode ─── */

  if (mode === "EXISTING") {
    const headingKey = awaitingFirstSession
      ? "bookings.pos.package.pickFirstSession"
      : "bookings.pos.package.existing.title"
    return (
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-foreground">{t(headingKey)}</h3>
        <PackageCreditPicker
          purchases={purchases ?? []}
          onPick={onCreditSelected}
          {...(onFlexibleCreditSelected
            ? { onPickFlexible: handlePickFlexible }
            : {})}
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={switchToBuy}
          className="self-start"
        >
          <HugeiconsIcon icon={Package01Icon} size={14} className="me-1.5" />
          {t("bookings.pos.package.buyNew")}
        </Button>
      </div>
    )
  }

  /* ─── Render: BUY mode (catalog) ─── */

  const catalogEmpty = !packagesLoading && sellablePackages.length === 0
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-foreground">
        {t("bookings.pos.package.catalog.title")}
      </h3>
      {catalogEmpty ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {t("bookings.pos.package.catalog.empty")}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {sellablePackages.map((pkg) => {
              const isSelected = pkg.id === selectedPackageId
              return (
                <CatalogCard
                  key={pkg.id}
                  pkg={pkg}
                  locale={locale}
                  selected={isSelected}
                  onToggle={() =>
                    setSelectedPackageId(isSelected ? null : pkg.id)
                  }
                  itemsCountLabel={itemsCountLabel(pkg.items.length)}
                />
              )
            })}
          </div>

          {selectedPkg && (
            <div className="flex flex-col gap-3 rounded-lg border bg-surface-solid p-3">
              <div className="flex flex-col gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  {t("packages.sell.collectPackagePrice")}
                </span>
                <MethodPicker
                  paymentSettings={paymentSettings}
                  method={method}
                  onChange={setMethod}
                />
              </div>
              <Button
                type="button"
                size="sm"
                disabled={sellMut.isPending}
                onClick={handleConfirmPurchase}
                className="self-start"
              >
                {sellMut.isPending
                  ? t("bookings.pos.package.purchasing")
                  : t("bookings.pos.package.confirmPurchase")}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
