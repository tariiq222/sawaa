"use client"

import { useEffect } from "react"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@deqah/ui"
import { useCategoryMutations } from "@/hooks/use-services"
import { useDepartmentOptions } from "@/hooks/use-departments"
import { useLocale } from "@/components/locale-provider"
import type { ServiceCategory } from "@/lib/types/service"
import {
  editCategorySchema,
  type EditCategoryFormData,
} from "@/lib/schemas/service.schema"

interface Props {
  category: ServiceCategory | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

const NO_DEPT = "__none"

export function EditCategoryDialog({ category, open, onOpenChange }: Props) {
  const { t, locale } = useLocale()
  const { updateMut } = useCategoryMutations()
  const { options: departments } = useDepartmentOptions()

  const form = useForm<EditCategoryFormData>({
    resolver: zodResolver(editCategorySchema),
  })

  useEffect(() => {
    if (category) {
      form.reset({
        nameAr: category.nameAr,
        nameEn: category.nameEn ?? "",
        sortOrder: category.sortOrder,
        isActive: category.isActive,
        departmentId: category.departmentId ?? undefined,
      })
    }
  }, [category, form])

  const translateError = (msg?: string) => (msg ? t(msg) : undefined)

  const onSubmit = form.handleSubmit(async (data) => {
    if (!category) return
    try {
      await updateMut.mutateAsync({
        id: category.id,
        nameAr: data.nameAr,
        nameEn: data.nameEn || undefined,
        sortOrder: data.sortOrder,
        isActive: data.isActive,
        departmentId: data.departmentId ? (data.departmentId as string) : null,
      })
      toast.success(t("services.categories.edit.success"))
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("services.categories.edit.error"))
    }
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("services.categories.edit.title")}</DialogTitle>
          <DialogDescription>{t("services.categories.edit.description")}</DialogDescription>
        </DialogHeader>

        <DialogBody>
          <form id="edit-category-form" onSubmit={onSubmit} className="flex flex-col gap-5">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label htmlFor="edit-cat-active" className="cursor-pointer">
                {t("services.categories.edit.isActive")}
              </Label>
              <Switch
                id="edit-cat-active"
                checked={!!form.watch("isActive")}
                onCheckedChange={(v) => form.setValue("isActive", v)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>{t("services.categories.create.nameAr")} *</Label>
                <Input {...form.register("nameAr")} dir="rtl" />
                {form.formState.errors.nameAr && (
                  <p className="text-xs text-destructive">
                    {translateError(form.formState.errors.nameAr.message)}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>{t("services.categories.create.nameEn")}</Label>
                <Input {...form.register("nameEn")} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>{t("services.categories.edit.department")}</Label>
                <Controller
                  control={form.control}
                  name="departmentId"
                  render={({ field }) => (
                    <Select
                      value={(field.value as string | undefined) || NO_DEPT}
                      onValueChange={(v) => field.onChange(v === NO_DEPT ? undefined : v)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={t("services.categories.edit.departmentPlaceholder")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NO_DEPT}>
                          {t("services.categories.edit.departmentPlaceholder")}
                        </SelectItem>
                        {departments.map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            {locale === "ar" ? d.nameAr : d.nameEn}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>{t("services.categories.create.sortOrder")}</Label>
                <Controller
                  control={form.control}
                  name="sortOrder"
                  render={({ field }) => (
                    <Input
                      type="number"
                      min={0}
                      max={999}
                      value={field.value ?? 0}
                      onChange={(e) =>
                        field.onChange(e.target.value === "" ? undefined : Number(e.target.value))
                      }
                    />
                  )}
                />
              </div>
            </div>
          </form>
        </DialogBody>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t("services.categories.edit.cancel")}
          </Button>
          <Button type="submit" form="edit-category-form" disabled={updateMut.isPending}>
            {updateMut.isPending
              ? t("services.categories.edit.submitting")
              : t("services.categories.edit.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
