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
import { useClientMutations } from "@/hooks/use-clients"
import type { Client } from "@/lib/types/client"

interface DeleteClientDialogProps {
  client: Client | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onDeleted?: () => void
}

export function DeleteClientDialog({ client, open, onOpenChange, onDeleted }: DeleteClientDialogProps) {
  const { t } = useLocale()
  const { deleteMut } = useClientMutations()

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault()
    if (!client) return
    deleteMut.mutate(client.id, {
      onSuccess: () => {
        toast.success(t("clients.delete.success"))
        onOpenChange(false)
        onDeleted?.()
      },
      onError: (err) => {
        toast.error(err instanceof Error ? err.message : t("clients.delete.error"))
      },
    })
  }

  const name = client ? `${client.firstName} ${client.lastName}` : ""

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("clients.delete.title")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("clients.delete.descriptionPrefix")} <strong>{name}</strong>
            {t("clients.delete.descriptionSuffix")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteMut.isPending}>
            {t("clients.delete.cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={deleteMut.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleteMut.isPending ? t("clients.delete.submitting") : t("clients.delete.submit")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
