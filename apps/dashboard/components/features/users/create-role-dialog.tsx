"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from "@deqah/ui"
import { Input } from "@deqah/ui"
import { Label } from "@deqah/ui"
import { Button } from "@deqah/ui"

import { useRoleMutations } from "@/hooks/use-users"
import { useLocale } from "@/components/locale-provider"
import {
  createRoleSchema,
  type CreateRoleFormData,
} from "@/lib/schemas/user.schema"

/* ─── Props ─── */

interface CreateRoleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/* ─── Component ─── */

export function CreateRoleDialog({ open, onOpenChange }: CreateRoleDialogProps) {
  const { t } = useLocale()
  const { createMut } = useRoleMutations()

  const form = useForm<CreateRoleFormData>({
    resolver: zodResolver(createRoleSchema),
    defaultValues: { name: "" },
  })

  const onSubmit = form.handleSubmit(async (data) => {
    try {
      await createMut.mutateAsync({
        name: data.name,
      })
      toast.success(t("users.roles.create.success"))
      form.reset()
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("users.roles.create.error"))
    }
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("users.roles.create.title")}</DialogTitle>
          <DialogDescription>
            {t("users.roles.create.description")}
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <form id="create-role-form" onSubmit={onSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="role-name">{t("users.roles.create.name")}</Label>
              <Input
                id="role-name"
                placeholder={t("users.roles.create.namePlaceholder")}
                {...form.register("name")}
              />
              {form.formState.errors.name && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>
          </form>
        </DialogBody>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {t("users.roles.create.cancel")}
          </Button>
          <Button type="submit" form="create-role-form" disabled={createMut.isPending}>
            {createMut.isPending ? t("users.roles.create.submitting") : t("users.roles.create.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
