"use client"

import { useMemo } from "react"
import { toast } from "sonner"
import { showApiError } from "@/lib/mutation-helpers"

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
import { usePackageMutations } from "@/hooks/use-packages"
import { useLocale } from "@/components/locale-provider"
import type { SessionPackage } from "@/lib/types/package"

interface Props {
  pkg: SessionPackage | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DeletePackageDialog({ pkg, open, onOpenChange }: Props) {
  const { t, locale } = useLocale()
  const { deleteMut } = usePackageMutations()

  const displayName = useMemo(() => {
    if (!pkg) return ""
    return locale === "ar" ? pkg.nameAr : (pkg.nameEn ?? pkg.nameAr)
  }, [pkg, locale])

  const handleDelete = async () => {
    if (!pkg) return
    try {
      await deleteMut.mutateAsync(pkg.id)
      toast.success(t("packages.delete.success"))
      onOpenChange(false)
    } catch (err) {
      showApiError(err, { fallback: t("packages.delete.error"), t })
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("packages.delete.title")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("packages.delete.description").replace("{name}", displayName)}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteMut.isPending}>
            {t("packages.delete.cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={deleteMut.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleteMut.isPending
              ? t("packages.delete.submitting")
              : t("packages.delete.confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
