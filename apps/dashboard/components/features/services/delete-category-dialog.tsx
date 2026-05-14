"use client"

import { useMemo } from "react"
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
import { useCategoryMutations } from "@/hooks/use-services"
import { useLocale } from "@/components/locale-provider"
import type { ServiceCategory } from "@/lib/types/service"

interface Props {
  category: ServiceCategory | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DeleteCategoryDialog({ category, open, onOpenChange }: Props) {
  const { t, locale } = useLocale()
  const { deleteMut } = useCategoryMutations()

  // Freeze display name keyed by category id so dropdown teardown
  // re-renders cannot swap in another row's name.
  const displayName = useMemo(() => {
    if (!category) return ""
    return locale === "ar" ? category.nameAr : (category.nameEn ?? category.nameAr)
  }, [category, locale])

  const handleDelete = async () => {
    if (!category) return
    try {
      await deleteMut.mutateAsync(category.id)
      toast.success(t("services.categories.delete.success"))
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("services.categories.delete.error"))
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("services.categories.delete.title")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("services.categories.delete.description").replace("{name}", displayName)}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteMut.isPending}>
            {t("services.categories.delete.cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={deleteMut.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleteMut.isPending
              ? t("services.categories.delete.submitting")
              : t("services.categories.delete.submit")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
