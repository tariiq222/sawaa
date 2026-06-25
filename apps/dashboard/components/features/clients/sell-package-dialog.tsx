"use client"

/**
 * Sell-package dialog shell — Sawaa Dashboard
 *
 * Wraps `SellPackageForm` in a Dialog. The form lives in a sibling file
 * so this shell stays small. The dialog is only mounted when the parent
 * (client detail page) sets `open=true`; remounting the form on open via
 * `{open && <SellPackageForm ... />}` (here) means the form seeds fresh
 * from the current client/branch state with no manual reset effect —
 * matching the `record-payment-dialog` pattern.
 *
 * UX gates:
 *   - `canDo("invoice", "create")` on the trigger button. Backend CASL
 *     (`@CheckPermissions({ action: 'manage', subject: 'Invoice' })`) is
 *     the source of truth; the UI gate is defense-in-depth so the button
 *     doesn't show for users who can't write invoices.
 */

import { HugeiconsIcon } from "@hugeicons/react"
import { ShoppingBagAddIcon } from "@hugeicons/core-free-icons"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@sawaa/ui"

import { useLocale } from "@/components/locale-provider"
import { SellPackageForm } from "./sell-package-form"

/* ─── Props ─── */

interface SellPackageDialogProps {
  clientId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

/* ─── Component ─── */

export function SellPackageDialog({
  clientId,
  open,
  onOpenChange,
}: SellPackageDialogProps) {
  const { t } = useLocale()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HugeiconsIcon
              icon={ShoppingBagAddIcon}
              size={18}
              className="text-primary"
            />
            {t("packages.sell.title")}
          </DialogTitle>
          <DialogDescription>{t("packages.sell.description")}</DialogDescription>
        </DialogHeader>
        {open && (
          <SellPackageForm
            clientId={clientId}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}