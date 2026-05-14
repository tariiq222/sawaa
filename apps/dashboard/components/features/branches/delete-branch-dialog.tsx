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
import { useBranchMutations } from "@/hooks/use-branches"
import type { Branch } from "@/lib/types/branch"

interface DeleteBranchDialogProps {
  branch: Branch | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DeleteBranchDialog({
  branch,
  open,
  onOpenChange,
}: DeleteBranchDialogProps) {
  const { t, locale } = useLocale()
  const { deleteMut } = useBranchMutations()

  const branchName = branch
    ? (locale === "ar" ? branch.nameAr : branch.nameEn)
    : ""

  const handleDelete = async () => {
    if (!branch) return
    try {
      await deleteMut.mutateAsync(branch.id)
      toast.success(t("branches.delete.success"))
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("branches.delete.error"))
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("branches.delete.title")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("branches.delete.description").replace("{name}", branchName)}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteMut.isPending}>
            {t("branches.delete.cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={deleteMut.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleteMut.isPending ? t("branches.delete.submitting") : t("branches.delete.submit")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
