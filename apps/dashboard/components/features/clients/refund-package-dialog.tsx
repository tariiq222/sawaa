"use client"

/**
 * Refund Package Purchase Dialog Shell — Sawaa Dashboard
 *
 * Mounts the form body inside a Dialog. The form lives in a sibling
 * file so this shell stays under the 300-line feature-component rule.
 * The dialog is mounted only when the parent sets `open=true`;
 * remounting the form on open via the `{open && <Form .../>}` pattern
 * means the form seeds fresh from the current purchase state with no
 * manual reset effect — matching the `sell-package-dialog` /
 * `credit-book-dialog` / `transfer-credit-dialog` convention.
 *
 * Used by the client package balances panel — the operator opens
 * this dialog from a purchase card and enters the refund amount +
 * optional notes.
 *
 * Permission gate: refund is gated on `manage:Setting` server-side
 * (OWNER/ADMIN, NOT ACCOUNTANT — see
 * apps/backend/src/api/dashboard/finance.controller.ts
 * `refundPackagePurchaseEndpoint`). The UI gate is defense-in-depth:
 * the trigger button in `client-package-balances-panel.tsx` checks
 * `canDo("setting", "manage")` before showing.
 */

import { HugeiconsIcon } from "@hugeicons/react"
import { DeliveryReturnIcon } from "@hugeicons/core-free-icons"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@sawaa/ui"

import { useLocale } from "@/components/locale-provider"
import { RefundPackageForm } from "./refund-package-form"
import type { PackagePurchase } from "@/lib/types/package-purchase"

/* ─── Props ─── */

interface RefundPackageDialogProps {
  purchase: PackagePurchase | null
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Optional callback fired when a refund succeeds. */
  onRefunded?: () => void
}

/* ─── Component ─── */

export function RefundPackageDialog({
  purchase,
  open,
  onOpenChange,
  onRefunded,
}: RefundPackageDialogProps) {
  const { t } = useLocale()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HugeiconsIcon
              icon={DeliveryReturnIcon}
              size={18}
              className="text-primary"
            />
            {t("packages.balances.refund.title")}
          </DialogTitle>
          <DialogDescription>
            {t("packages.balances.refund.description")}
          </DialogDescription>
        </DialogHeader>
        {open && purchase && (
          <RefundPackageForm
            purchase={purchase}
            onClose={() => onOpenChange(false)}
            onRefunded={onRefunded}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
