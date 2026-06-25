"use client"

/**
 * Credit-Book Dialog Shell — Sawaa Dashboard
 *
 * Mounts the form body inside a Dialog. The form lives in a sibling
 * file so this shell stays small (<300 lines per the dashboard
 * feature-component rule). The dialog is mounted only when the parent
 * sets `open=true`; remounting the form on open via the `{open && …}`
 * pattern means the form seeds fresh from the current credit state
 * with no manual reset effect — matching the `sell-package-dialog`
 * convention.
 *
 * Used by the client package balances panel — each credit row opens
 * this dialog with that credit's (serviceId, employeeId,
 * durationOptionId) pre-filled, so the operator just picks branch +
 * day + time.
 */

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@sawaa/ui"

import { useLocale } from "@/components/locale-provider"
import { CreditBookForm } from "./credit-book-form"
import type { PackageCredit } from "@/lib/types/package-purchase"

/* ─── Props ─── */

interface CreditBookDialogProps {
  clientId: string
  credit: PackageCredit | null
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Optional callback fired when a credit booking is successfully created. */
  onBooked?: () => void
}

/* ─── Component ─── */

export function CreditBookDialog({
  clientId,
  credit,
  open,
  onOpenChange,
  onBooked,
}: CreditBookDialogProps) {
  const { t } = useLocale()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("packages.balances.book.title")}</DialogTitle>
          <DialogDescription>
            {t("packages.balances.book.description")}
          </DialogDescription>
        </DialogHeader>
        {open && credit && (
          <CreditBookForm
            clientId={clientId}
            credit={credit}
            onClose={() => onOpenChange(false)}
            onBooked={onBooked}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}