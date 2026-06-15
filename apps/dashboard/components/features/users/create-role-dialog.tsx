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
} from "@sawaa/ui"
import { Input } from "@sawaa/ui"
import { Label } from "@sawaa/ui"
import { Button } from "@sawaa/ui"

import { useRoleMutations } from "@/hooks/use-users"
import { useLocale } from "@/components/locale-provider"
import { ApiError } from "@/lib/api"
import {
  createRoleSchema,
  type CreateRoleFormData,
} from "@/lib/schemas/user.schema"
import type { Role } from "@/lib/types/user"

/* ─── Props ─── */

interface CreateRoleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: (role: Role) => void
}

/* ─── Component ─── */

export function CreateRoleDialog({ open, onOpenChange, onCreated }: CreateRoleDialogProps) {
  const { t } = useLocale()
  const { createMut } = useRoleMutations()

  const form = useForm<CreateRoleFormData>({
    resolver: zodResolver(createRoleSchema),
    defaultValues: { name: "" },
  })

  const onSubmit = form.handleSubmit(async (data) => {
    try {
      const newRole = await createMut.mutateAsync({
        name: data.name,
      })
      toast.success(t("users.roles.create.success"))
      form.reset()
      onOpenChange(false)
      onCreated?.(newRole)
    } catch (err) {
      // 409 ConflictException = name already exists (most common failure).
      // Validation errors are caught by zod on the client before we get here.
      if (err instanceof ApiError && err.status === 409) {
        form.setError("name", { message: t("users.roles.create.nameTaken") })
        return
      }
      toast.error(err instanceof Error ? err.message : t("users.roles.create.error"))
    }
  })

  const nameError = form.formState.errors.name

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
                aria-invalid={nameError ? "true" : "false"}
                aria-describedby={nameError ? "role-name-error" : undefined}
                {...form.register("name")}
              />
              {nameError && (
                <p id="role-name-error" className="text-xs text-destructive">
                  {nameError.message}
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
