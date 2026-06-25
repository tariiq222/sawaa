"use client"

/**
 * Transfer Credit Dialog Shell — Sawaa Dashboard
 *
 * Mounts the form body inside a Dialog. The form lives in a sibling
 * file so this shell stays under the 300-line feature-component rule.
 * The dialog is mounted only when the parent sets `open=true`;
 * remounting the form on open via the `{open && <Form .../>}` pattern
 * means the form seeds fresh from the current credit state with no
 * manual reset effect — matching the `sell-package-dialog` /
 * `credit-book-dialog` convention.
 *
 * Used by the client package balances panel — each credit row opens
 * this dialog with that credit's (serviceId, employeeId,
 * durationOptionId) so the operator can pick a different
 * practitioner who provides the SAME service+duration.
 *
 * Permission gate: transfer is gated on `manage:Booking` server-side
 * (see apps/backend/src/api/dashboard/bookings.controller.ts). The
 * UI gate is defense-in-depth: the trigger button in
 * `client-package-balances-panel.tsx` checks `canDo("booking",
 * "manage")` before showing; this dialog simply trusts the caller.
 */

import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowDataTransferHorizontalIcon } from "@hugeicons/core-free-icons"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@sawaa/ui"

import { useLocale } from "@/components/locale-provider"
import { TransferCreditForm } from "./transfer-credit-form"
import type { PackageCredit } from "@/lib/types/package-purchase"

/* ─── Props ─── */

interface TransferCreditDialogProps {
  credit: PackageCredit | null
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Optional callback fired when a credit transfer succeeds. */
  onTransferred?: () => void
}

/* ─── Component ─── */

export function TransferCreditDialog({
  credit,
  open,
  onOpenChange,
  onTransferred,
}: TransferCreditDialogProps) {
  const { t } = useLocale()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HugeiconsIcon
              icon={ArrowDataTransferHorizontalIcon}
              size={18}
              className="text-primary"
            />
            {t("packages.balances.transfer.title")}
          </DialogTitle>
          <DialogDescription>
            {t("packages.balances.transfer.description")}
          </DialogDescription>
        </DialogHeader>
        {open && credit && (
          <TransferCreditForm
            credit={credit}
            onClose={() => onOpenChange(false)}
            onTransferred={onTransferred}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
