"use client"

import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@deqah/ui"
import { useCouponMutations } from "@/hooks/use-coupons"
import { useLocale } from "@/components/locale-provider"
import type { Coupon } from "@/lib/types/coupon"

/* ─── Props ─── */

interface DeleteCouponDialogProps {
  coupon: Coupon | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

/* ─── Component ─── */

export function DeleteCouponDialog({
  coupon,
  open,
  onOpenChange,
}: DeleteCouponDialogProps) {
  const { t } = useLocale()
  const { deleteMut } = useCouponMutations()

  const handleDelete = async () => {
    if (!coupon) return
    try {
      await deleteMut.mutateAsync(coupon.id)
      toast.success(t("coupons.delete.success"))
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("coupons.delete.error"))
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("coupons.delete.title")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("coupons.delete.description").replace("{code}", coupon?.code ?? "")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteMut.isPending}>
            {t("coupons.delete.cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={deleteMut.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleteMut.isPending ? t("coupons.delete.submitting") : t("coupons.delete.submit")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
