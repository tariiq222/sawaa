"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useLocale } from "@/components/locale-provider"
import { useGroupSessionMutations } from "@/hooks/use-group-sessions"
import { cancelGroupSessionSchema } from "@/lib/schemas/group-session.schema"
import type { CancelGroupSessionFormData } from "@/lib/schemas/group-session.schema"
import type { GroupSessionListItem } from "@/lib/types/group-session"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  Textarea,
  Label,
} from "@sawaa/ui"

interface Props {
  session: GroupSessionListItem
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CancelGroupSessionDialog({ session, open, onOpenChange }: Props) {
  const { t } = useLocale()
  const { cancelMut } = useGroupSessionMutations()

  const {
    register,
    handleSubmit,
    reset,
  } = useForm<CancelGroupSessionFormData>({
    resolver: zodResolver(cancelGroupSessionSchema),
    defaultValues: { cancelReason: "" },
  })

  const onSubmit = (data: CancelGroupSessionFormData) => {
    cancelMut.mutate(
      { id: session.id, cancelReason: data.cancelReason || undefined },
      {
        onSuccess: () => {
          reset()
          onOpenChange(false)
        },
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("groupSessions.cancel.title")}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{t("groupSessions.cancel.description")}</p>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <Label>{t("groupSessions.cancel.reasonLabel")}</Label>
            <Textarea
              rows={3}
              placeholder={t("groupSessions.cancel.reasonPlaceholder")}
              {...register("cancelReason")}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" variant="destructive" disabled={cancelMut.isPending}>
              {cancelMut.isPending ? t("groupSessions.cancel.submitting") : t("groupSessions.cancel.button")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
