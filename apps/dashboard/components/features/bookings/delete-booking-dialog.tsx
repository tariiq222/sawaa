"use client"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@sawaa/ui"
import { useLocale } from "@/components/locale-provider"

interface DeleteBookingDialogProps {
  open: boolean
  loading: boolean
  onClose: () => void
  onConfirm: () => void
}

export function DeleteBookingDialog({ open, loading, onClose, onConfirm }: DeleteBookingDialogProps) {
  const { t } = useLocale()
  return (
    <AlertDialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("bookings.delete.title")}</AlertDialogTitle>
          <AlertDialogDescription>{t("bookings.delete.description")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>{t("bookings.delete.cancel")}</AlertDialogCancel>
          <AlertDialogAction
            disabled={loading}
            onClick={(e) => { e.preventDefault(); onConfirm() }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {t("bookings.delete.confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
