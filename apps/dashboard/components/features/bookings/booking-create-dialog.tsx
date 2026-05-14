"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@deqah/ui"
import { useLocale } from "@/components/locale-provider"
import { BookingWizard } from "./booking-wizard"

interface BookingCreateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function BookingCreateDialog({
  open,
  onOpenChange,
  onSuccess,
}: BookingCreateDialogProps) {
  const { t } = useLocale()

  function handleSuccess() {
    onOpenChange(false)
    onSuccess()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden" showCloseButton={false}>
        <DialogHeader className="sr-only">
          <DialogTitle>{t("bookings.create.dialogTitle")}</DialogTitle>
        </DialogHeader>
        <BookingWizard
          onSuccess={handleSuccess}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}
