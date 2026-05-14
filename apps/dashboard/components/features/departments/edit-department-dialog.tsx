"use client"

import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"

import { ApiError } from "@/lib/api"
import { Button } from "@deqah/ui"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogBody,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@deqah/ui"
import { Input } from "@deqah/ui"
import { Label } from "@deqah/ui"
import { Switch } from "@deqah/ui"
import { Separator } from "@deqah/ui"
import { useDepartmentMutations } from "@/hooks/use-departments"
import { useLocale } from "@/components/locale-provider"
import {
  departmentSchema,
  type DepartmentFormData,
} from "@/lib/schemas/department.schema"
import type { Department } from "@/lib/types/department"

interface EditDepartmentDialogProps {
  department: Department | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EditDepartmentDialog({
  department,
  open,
  onOpenChange,
}: EditDepartmentDialogProps) {
  const { t } = useLocale()
  const { updateMut } = useDepartmentMutations()

  const form = useForm<DepartmentFormData>({
    resolver: zodResolver(departmentSchema),
    defaultValues: {
      nameAr: "",
      nameEn: "",
      descriptionAr: "",
      descriptionEn: "",
      icon: "",
      sortOrder: 0,
      isActive: true,
    },
  })

  useEffect(() => {
    if (department && open) {
      form.reset({
        nameAr: department.nameAr,
        nameEn: department.nameEn,
        descriptionAr: department.descriptionAr ?? "",
        descriptionEn: department.descriptionEn ?? "",
        icon: department.icon ?? "",
        sortOrder: department.sortOrder ?? 0,
        isActive: department.isActive,
      })
    } else if (!open) {
      form.reset({
        nameAr: "",
        nameEn: "",
        descriptionAr: "",
        descriptionEn: "",
        icon: "",
        sortOrder: 0,
        isActive: true,
      })
    }
  }, [department, open, form])

  const onSubmit = form.handleSubmit(async (data) => {
    if (!department) return
    try {
      await updateMut.mutateAsync({
        id: department.id,
        nameAr: data.nameAr,
        nameEn: data.nameEn,
        descriptionAr: data.descriptionAr || undefined,
        descriptionEn: data.descriptionEn || undefined,
        icon: data.icon || undefined,
        sortOrder: data.sortOrder,
        isActive: data.isActive,
      })
      toast.success(t("departments.edit.success"))
      onOpenChange(false)
    } catch (err) {
      if (err instanceof ApiError && err.code === "DEPARTMENT_NAME_EXISTS") {
        toast.error(t("departments.create.duplicate"))
      } else {
        toast.error(err instanceof Error ? err.message : t("departments.edit.error"))
      }
    }
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("departments.edit.title")}</DialogTitle>
          <DialogDescription>{t("departments.edit.description")}</DialogDescription>
        </DialogHeader>

        <DialogBody>
          <form id="edit-dept-form" onSubmit={onSubmit} className="flex flex-col gap-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>{t("departments.field.nameAr")} *</Label>
                <Input {...form.register("nameAr")} />
                {form.formState.errors.nameAr && (
                  <p className="text-xs text-destructive">
                    {t(form.formState.errors.nameAr.message ?? "")}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>{t("departments.field.nameEn")} *</Label>
                <Input {...form.register("nameEn")} />
                {form.formState.errors.nameEn && (
                  <p className="text-xs text-destructive">
                    {t(form.formState.errors.nameEn.message ?? "")}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>{t("departments.field.descriptionAr")}</Label>
                <Input {...form.register("descriptionAr")} />
                {form.formState.errors.descriptionAr && (
                  <p className="text-xs text-destructive">
                    {t(form.formState.errors.descriptionAr.message ?? "")}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>{t("departments.field.descriptionEn")}</Label>
                <Input {...form.register("descriptionEn")} />
                {form.formState.errors.descriptionEn && (
                  <p className="text-xs text-destructive">
                    {t(form.formState.errors.descriptionEn.message ?? "")}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>{t("departments.field.icon")}</Label>
                <Input
                  {...form.register("icon")}
                  placeholder={t("departments.field.iconPlaceholder")}
                />
                {form.formState.errors.icon && (
                  <p className="text-xs text-destructive">
                    {t(form.formState.errors.icon.message ?? "")}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>{t("departments.field.sortOrder")}</Label>
                <Input
                  type="number"
                  min={0}
                  max={9999}
                  {...form.register("sortOrder", { valueAsNumber: true })}
                  className="h-9 text-sm tabular-nums"
                />
                {form.formState.errors.sortOrder && (
                  <p className="text-xs text-destructive">
                    {t(form.formState.errors.sortOrder.message ?? "")}
                  </p>
                )}
              </div>
            </div>

            <Separator />

            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label htmlFor="edit-dept-active" className="cursor-pointer">
                {t("departments.field.isActive")}
              </Label>
              <Switch
                id="edit-dept-active"
                checked={form.watch("isActive")}
                onCheckedChange={(v) => form.setValue("isActive", v)}
              />
            </div>
          </form>
        </DialogBody>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {t("departments.edit.cancel")}
          </Button>
          <Button type="submit" form="edit-dept-form" disabled={updateMut.isPending}>
            {updateMut.isPending ? t("departments.edit.submitting") : t("departments.edit.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
