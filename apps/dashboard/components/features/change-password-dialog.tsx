"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
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
import { changePassword } from "@/lib/api/auth"
import { useLocale } from "@/components/locale-provider"
import { showApiError } from "@/lib/mutation-helpers"
import { useState } from "react"

const schema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(8, "Must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })

type FormData = z.infer<typeof schema>

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ChangePasswordDialog({ open, onOpenChange }: Props) {
  const { t } = useLocale()
  const [loading, setLoading] = useState(false)

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  })

  const onSubmit = form.handleSubmit(async (data) => {
    setLoading(true)
    try {
      await changePassword(data.currentPassword, data.newPassword)
      toast.success(t("changePassword.success"))
      form.reset()
      onOpenChange(false)
    } catch (err) {
      showApiError(err, { fallback: t("changePassword.error"), t })
    } finally {
      setLoading(false)
    }
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("changePassword.title")}</DialogTitle>
          <DialogDescription>
            {t("changePassword.description")}
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <form id="change-password-form" onSubmit={onSubmit} className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cp-current">{t("changePassword.current")} *</Label>
              <Input
                id="cp-current"
                type="password"
                aria-invalid={form.formState.errors.currentPassword ? "true" : undefined}
                aria-describedby={form.formState.errors.currentPassword ? "cp-current-error" : undefined}
                {...form.register("currentPassword")}
              />
              {form.formState.errors.currentPassword && (
                <p id="cp-current-error" className="text-xs text-destructive">
                  {form.formState.errors.currentPassword.message}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cp-new">{t("changePassword.new")} *</Label>
              <Input
                id="cp-new"
                type="password"
                aria-invalid={form.formState.errors.newPassword ? "true" : undefined}
                aria-describedby={form.formState.errors.newPassword ? "cp-new-error" : undefined}
                {...form.register("newPassword")}
              />
              {form.formState.errors.newPassword && (
                <p id="cp-new-error" className="text-xs text-destructive">
                  {form.formState.errors.newPassword.message}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cp-confirm">{t("changePassword.confirm")} *</Label>
              <Input
                id="cp-confirm"
                type="password"
                aria-invalid={form.formState.errors.confirmPassword ? "true" : undefined}
                aria-describedby={form.formState.errors.confirmPassword ? "cp-confirm-error" : undefined}
                {...form.register("confirmPassword")}
              />
              {form.formState.errors.confirmPassword && (
                <p id="cp-confirm-error" className="text-xs text-destructive">
                  {form.formState.errors.confirmPassword.message}
                </p>
              )}
            </div>
          </form>
        </DialogBody>

        <DialogFooter>
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            {t("changePassword.cancel")}
          </Button>
          <Button type="submit" size="sm" form="change-password-form" disabled={loading}>
            {loading ? t("changePassword.submitting") : t("changePassword.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
