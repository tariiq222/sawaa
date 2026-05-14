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
import { useLocale } from "@/components/locale-provider"
import { useDepartmentMutations } from "@/hooks/use-departments"
import type { Department } from "@/lib/types/department"

interface DeleteDepartmentDialogProps {
  department: Department | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DeleteDepartmentDialog({
  department,
  open,
  onOpenChange,
}: DeleteDepartmentDialogProps) {
  const { t, locale } = useLocale()
  const { deleteMut } = useDepartmentMutations()

  const name = department
    ? (locale === "ar" ? department.nameAr : department.nameEn)
    : ""
  const categoryCount =
    department?._count?.categories ?? department?.categories?.length ?? 0
  const description =
    categoryCount > 0
      ? t("departments.delete.descriptionWithCategories")
          .replace("{name}", name)
          .replace("{count}", String(categoryCount))
      : t("departments.delete.descriptionNoCategories").replace("{name}", name)

  const handleDelete = async () => {
    if (!department || deleteMut.isPending) return
    const id = department.id
    onOpenChange(false)
    try {
      await deleteMut.mutateAsync(id)
      toast.success(t("departments.delete.success"))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("departments.delete.error"))
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("departments.delete.title")}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteMut.isPending}>
            {t("departments.delete.cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={deleteMut.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleteMut.isPending
              ? t("departments.delete.submitting")
              : t("departments.delete.submit")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
