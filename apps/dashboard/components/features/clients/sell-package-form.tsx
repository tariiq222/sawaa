"use client"

/**
 * Sell-package form body — Sawaa Dashboard
 *
 * Renders the package + branch + payment-method + notes + price-preview
 * form fields and owns the submit state. Lives separately from the
 * `SellPackageDialog` shell so each file stays under the dashboard's
 * 300-line feature-component limit.
 *
 * Payment-method options mirror the dashboard's `record-payment-dialog`
 * (CASH / BANK_TRANSFER / MADA / TABBY), gated by `usePaymentSettings`
 * so users never see a method the clinic has disabled.
 *
 * The submit path:
 *   1. POST /dashboard/finance/package-purchases with the resolved
 *      `{ packageId, clientId, branchId, method, notes? }`.
 *   2. On success, toast + close the dialog. The hook invalidates
 *      package-purchases / payments / invoices so the balances tab
 *      and any open bookings/invoices lists refresh on next mount.
 *   3. On failure, showApiError formats 4xx (server message), 5xx
 *      (localized + request id), network, or the localized fallback.
 */

import { useMemo, useState } from "react"
import { toast } from "sonner"

import {
  Button,
  DialogBody,
  DialogFooter,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Textarea,
} from "@sawaa/ui"

import { useLocale } from "@/components/locale-provider"
import { usePackagesList } from "@/hooks/use-packages"
import { useBranches } from "@/hooks/use-branches"
import { usePaymentSettings } from "@/hooks/use-organization-settings"
import { useSellPackage } from "@/hooks/use-package-purchases"
import { showApiError } from "@/lib/mutation-helpers"
import { cn } from "@/lib/utils"
import type { SessionPackage } from "@/lib/types/package"
import type {
  CreatePackagePurchasePayload,
  PackagePurchasePaymentMethod,
} from "@/lib/types/package-purchase"
import { SellPackagePricePreview } from "./sell-package-price-preview"

/* ─── Payment-method constants ─── */

/**
 * Reception-allowed manual payment methods. Mirrors the dashboard's
 * `record-payment-dialog` (CASH / BANK_TRANSFER / MADA / TABBY).
 * ONLINE_CARD is rejected server-side and COUPON is reserved, so they
 * never appear in the UI.
 */
type PayMethod = "CASH" | "BANK_TRANSFER" | "MADA" | "TABBY"

const METHOD_OPTIONS: {
  value: PayMethod
  labelKey: string
  settingKey:
    | "payMethodCashEnabled"
    | "payMethodBankEnabled"
    | "payMethodMadaEnabled"
    | "payMethodTabbyEnabled"
}[] = [
  { value: "CASH", labelKey: "packages.sell.method.cash", settingKey: "payMethodCashEnabled" },
  { value: "BANK_TRANSFER", labelKey: "packages.sell.method.bankTransfer", settingKey: "payMethodBankEnabled" },
  { value: "MADA", labelKey: "packages.sell.method.mada", settingKey: "payMethodMadaEnabled" },
  { value: "TABBY", labelKey: "packages.sell.method.tabby", settingKey: "payMethodTabbyEnabled" },
]

/* ─── Props ─── */

interface SellPackageFormProps {
  clientId: string
  onClose: () => void
}

/* ─── Component ─── */

export function SellPackageForm({ clientId, onClose }: SellPackageFormProps) {
  const { t, locale } = useLocale()
  const { packages, isLoading: packagesLoading } = usePackagesList()
  const { branches, isLoading: branchesLoading } = useBranches()
  const { data: paymentSettings } = usePaymentSettings()
  const sellMut = useSellPackage()

  // Restrict to packages the backend will actually accept: active and not
  // archived. The list endpoint already excludes archived rows, so we
  // only need to filter out deactivated ones in the UI.
  const sellable = useMemo(
    () => (packages ?? []).filter((p) => p.isActive),
    [packages],
  )

  const activeBranches = useMemo(
    () => (branches ?? []).filter((b) => b.isActive),
    [branches],
  )

  // Same enabled-methods gating as record-payment-dialog so the user
  // never sees options the clinic has disabled.
  const enabledMethods = useMemo(() => {
    const list = METHOD_OPTIONS.filter((m) => paymentSettings?.[m.settingKey])
    return list.length > 0 ? list : METHOD_OPTIONS.filter((m) => m.value === "CASH")
  }, [paymentSettings])

  const [packageId, setPackageId] = useState<string>("")
  const [branchId, setBranchId] = useState<string>("")
  const [method, setMethod] = useState<PayMethod>(
    (enabledMethods[0]?.value as PayMethod) ?? "CASH",
  )
  const [notes, setNotes] = useState("")

  const selectedPkg = useMemo<SessionPackage | undefined>(
    () => sellable.find((p) => p.id === packageId),
    [sellable, packageId],
  )

  // The activeMethod handles the late-loads-settings race: if the user
  // already picked a method that gets disabled, fall back to the first
  // enabled one. Same approach as record-payment-dialog.
  const activeMethod: PayMethod = enabledMethods.some((m) => m.value === method)
    ? method
    : (enabledMethods[0]?.value as PayMethod) ?? "CASH"

  const canSubmit =
    !!packageId &&
    !!branchId &&
    !!activeMethod &&
    !sellMut.isPending &&
    !packagesLoading &&
    !branchesLoading

  async function onSubmit() {
    if (!packageId || !branchId) return
    const payload: CreatePackagePurchasePayload = {
      packageId,
      clientId,
      branchId,
      method: activeMethod as PackagePurchasePaymentMethod,
      notes: notes.trim() || undefined,
    }
    try {
      await sellMut.mutateAsync(payload)
      toast.success(t("packages.sell.success"))
      onClose()
    } catch (err) {
      showApiError(err, {
        fallback: t("packages.sell.error"),
        t,
        dedupeKey: "sell-package-error",
      })
    }
  }

  const packageLabel = (p: SessionPackage) =>
    locale === "ar" ? p.nameAr : (p.nameEn ?? p.nameAr)

  return (
    <>
      <DialogBody>
        <div className="flex flex-col gap-4">
          {/* ── Package selector ── */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="sell-package">{t("packages.sell.package")}</Label>
            {packagesLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : sellable.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("packages.sell.noPackages")}
              </p>
            ) : (
              <Select value={packageId} onValueChange={setPackageId}>
                <SelectTrigger id="sell-package" className="w-full">
                  <SelectValue placeholder={t("packages.sell.packagePlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {sellable.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {packageLabel(p)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* ── Branch selector ── */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="sell-branch">{t("packages.sell.branch")}</Label>
            {branchesLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : activeBranches.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("packages.sell.noBranches")}
              </p>
            ) : (
              <Select value={branchId} onValueChange={setBranchId}>
                <SelectTrigger id="sell-branch" className="w-full">
                  <SelectValue placeholder={t("packages.sell.branchPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {activeBranches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {locale === "ar" ? b.nameAr : b.nameEn}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* ── Payment method (radiogroup, same UX as record-payment) ── */}
          <div className="flex flex-col gap-2">
            <Label>{t("packages.sell.paymentMethod")}</Label>
            <div
              className="grid grid-cols-3 gap-2"
              role="radiogroup"
              aria-label={t("packages.sell.paymentMethod")}
            >
              {enabledMethods.map((m) => {
                const selected = activeMethod === m.value
                return (
                  <button
                    key={m.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setMethod(m.value)}
                    className={cn(
                      "rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors",
                      selected
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-surface text-foreground hover:bg-muted",
                    )}
                  >
                    {t(m.labelKey)}
                  </button>
                )
              })}
            </div>
          </div>

          {/* ── Notes (free-form, ≤2000 chars to match backend DTO) ── */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="sell-notes">{t("packages.sell.notes")}</Label>
            <Textarea
              id="sell-notes"
              rows={2}
              maxLength={2000}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t("packages.sell.notesPlaceholder")}
            />
          </div>

          {/* ── Frozen price preview (server-computed, read-only) ── */}
          <SellPackagePricePreview pkg={selectedPkg} />
        </div>
      </DialogBody>

      <DialogFooter>
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          {t("packages.sell.cancel")}
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={!canSubmit}
          onClick={onSubmit}
        >
          {sellMut.isPending
            ? t("packages.sell.submitting")
            : t("packages.sell.submit")}
        </Button>
      </DialogFooter>
    </>
  )
}