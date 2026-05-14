"use client"

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
import {
  createCategorySchema,
  type CreateCategoryFormData,
} from "@/lib/schemas/service.schema"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const NO_DEPT = "__none"

export function CreateCategoryDialog({ open, onOpenChange }: Props) {
  const { t, locale } = useLocale()
  const { createMut } = useCategoryMutations()
  const { options: departments } = useDepartmentOptions()

  const form = useForm<CreateCategoryFormData>({
    resolver: zodResolver(createCategorySchema),
    defaultValues: { nameAr: "", nameEn: "", sortOrder: 0, departmentId: undefined },
  })

  const translateError = (msg?: string) => (msg ? t(msg) : undefined)

  const onSubmit = form.handleSubmit(async (data) => {
    try {
      await createMut.mutateAsync({
        nameAr: data.nameAr,
        nameEn: data.nameEn || undefined,
        sortOrder: data.sortOrder,
        departmentId: data.departmentId || undefined,
      })
      toast.success(t("services.categories.create.success"))
      form.reset()
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("services.categories.create.error"))
    }
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("services.categories.create.title")}</DialogTitle>
          <DialogDescription>{t("services.categories.create.description")}</DialogDescription>
        </DialogHeader>

        <DialogBody>
          <form id="create-category-form" onSubmit={onSubmit} className="flex flex-col gap-5">
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
                <Label>{t("services.categories.create.department")}</Label>
                <Controller
                  control={form.control}
                  name="departmentId"
                  render={({ field }) => (
                    <Select
                      value={field.value || NO_DEPT}
                      onValueChange={(v) => field.onChange(v === NO_DEPT ? undefined : v)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={t("services.categories.create.departmentPlaceholder")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NO_DEPT}>
                          {t("services.categories.create.departmentPlaceholder")}
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
            {t("services.categories.create.cancel")}
          </Button>
          <Button type="submit" form="create-category-form" disabled={createMut.isPending}>
            {createMut.isPending
              ? t("services.categories.create.submitting")
              : t("services.categories.create.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
