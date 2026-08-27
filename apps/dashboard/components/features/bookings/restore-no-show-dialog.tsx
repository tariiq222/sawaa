"use client"

/**
 * restore-no-show-dialog.tsx
 *
 * Dialog that asks staff for a written reason (min 3 chars after trim) before
 * restoring a booking from `no_show` back to `confirmed + checkedInAt`.
 * Confirm is disabled while loading or until the reason passes the trim-length
 * gate; submit and close are wired through the `onConfirm` / `onReset` props
 * so the parent owns the mutation lifecycle.
 *
 * Visual pattern mirrors the cancel-dialogs family (Dialog primitives from
 * `@sawaa/ui`, Textarea + Label for the reason field, Button pair in the
 * footer with default-variant confirm and outline dismiss).
 */

import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
  Textarea,
} from "@sawaa/ui"
import { useLocale } from "@/components/locale-provider"

const MIN_REASON_LENGTH = 3

interface RestoreNoShowDialogProps {
  open: boolean
  reason: string
  setReason: (v: string) => void
  loading: boolean
  onReset: () => void
  onConfirm: () => void
}

export function RestoreNoShowDialog({
  open,
  reason,
  setReason,
  loading,
  onReset,
  onConfirm,
}: RestoreNoShowDialogProps) {
  const { t } = useLocale()
  const trimmed = reason.trim()
  const canSubmit = trimmed.length >= MIN_REASON_LENGTH && !loading

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onReset()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("bookings.restoreNoShow.title")}</DialogTitle>
          <DialogDescription>{t("bookings.restoreNoShow.desc")}</DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-2">
          <Label htmlFor="restore-no-show-reason">
            {t("bookings.restoreNoShow.reasonLabel")}
          </Label>
          <Textarea
            id="restore-no-show-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t("bookings.restoreNoShow.reasonPlaceholder")}
            rows={3}
            disabled={loading}
          />
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onReset} disabled={loading}>
            {t("bookings.cancel.button.dismiss")}
          </Button>
          <Button size="sm" onClick={onConfirm} disabled={!canSubmit}>
            {loading
              ? t("bookings.cancel.button.processing")
              : t("bookings.restoreNoShow.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
