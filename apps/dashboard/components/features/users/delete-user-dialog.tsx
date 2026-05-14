"use client"

import { toast } from "sonner"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@deqah/ui"
import { Button } from "@deqah/ui"

import { useUserMutations } from "@/hooks/use-users"
import { useLocale } from "@/components/locale-provider"
import type { User } from "@/lib/types/user"

/* ─── Props ─── */

interface DeleteUserDialogProps {
  user: User | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

/* ─── Component ─── */

export function DeleteUserDialog({ user, open, onOpenChange }: DeleteUserDialogProps) {
  const { deleteMut } = useUserMutations()
  const { t } = useLocale()

  const handleDelete = async () => {
    if (!user) return
    try {
      await deleteMut.mutateAsync(user.id)
      toast.success(t("users.delete.success"))
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("users.delete.error"))
    }
  }

  const userName = user?.name ?? ""

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("users.delete.title")}</DialogTitle>
          <DialogDescription>
            {t("users.delete.descriptionPrefix")}{" "}
            <strong>{userName}</strong>
            {t("users.delete.descriptionSuffix")}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("users.delete.cancel")}
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleteMut.isPending}
          >
            {deleteMut.isPending ? t("users.delete.submitting") : t("users.delete.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
