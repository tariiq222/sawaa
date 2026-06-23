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
import { useBundleMutations } from "@/hooks/use-bundles"
import { useLocale } from "@/components/locale-provider"
import type { ServiceBundle } from "@/lib/types/bundle"

interface Props {
  bundle: ServiceBundle | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DeleteBundleDialog({ bundle, open, onOpenChange }: Props) {
  const { t, locale } = useLocale()
  const { deleteMut } = useBundleMutations()

  const displayName = useMemo(() => {
    if (!bundle) return ""
    return locale === "ar" ? bundle.nameAr : (bundle.nameEn ?? bundle.nameAr)
  }, [bundle, locale])

  const handleDelete = async () => {
    if (!bundle) return
    try {
      await deleteMut.mutateAsync(bundle.id)
      toast.success(t("bundles.delete.success"))
      onOpenChange(false)
    } catch (err) {
      showApiError(err, { fallback: t("bundles.delete.error"), t })
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("bundles.delete.title")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("bundles.delete.description").replace("{name}", displayName)}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteMut.isPending}>
            {t("bundles.delete.cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={deleteMut.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleteMut.isPending
              ? t("bundles.delete.submitting")
              : t("bundles.delete.confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
