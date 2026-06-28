"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { useQuery } from "@tanstack/react-query"

import { ListPageShell } from "@/components/features/list-page-shell"
import { PageHeader } from "@/components/features/page-header"
import { Breadcrumbs } from "@/components/features/breadcrumbs"
import { Button } from "@sawaa/ui"
import { Input } from "@sawaa/ui"
import { Label } from "@sawaa/ui"
import { Separator } from "@sawaa/ui"
import { Skeleton } from "@sawaa/ui"
import { Switch } from "@sawaa/ui"
import { useDepartmentMutations } from "@/hooks/use-departments"
import { useLocale } from "@/components/locale-provider"
import { fetchDepartments } from "@/lib/api/departments"
import { queryKeys } from "@/lib/query-keys"
import { ApiError } from "@/lib/api"
import { departmentSchema, type DepartmentFormData } from "@/lib/schemas/department.schema"

type Props =
  | { mode: "create" }
  | { mode: "edit"; departmentId: string }

const DEFAULT_VALUES: DepartmentFormData = {
  nameAr: "",
  nameEn: "",
  descriptionAr: "",
  descriptionEn: "",
  icon: "",
  sortOrder: 0,
  isActive: true,
  isVisible: true,
}

export function DepartmentFormPage(props: Props) {
  const { t } = useLocale()
  const router = useRouter()
  const { createMut, updateMut } = useDepartmentMutations()

  const isEdit = props.mode === "edit"
  const departmentId = isEdit ? props.departmentId : undefined

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.departments.list({ all: true }),
    queryFn: () => fetchDepartments({ limit: 200 }),
    enabled: isEdit,
  })

  const department = data?.items.find((d) => d.id === departmentId)

  const isPending = isEdit ? updateMut.isPending : createMut.isPending

  const form = useForm<DepartmentFormData>({
    resolver: zodResolver(departmentSchema),
    defaultValues: DEFAULT_VALUES,
  })

  useEffect(() => {
    if (department && isEdit) {
      form.reset({
        nameAr: department.nameAr,
        nameEn: department.nameEn,
        descriptionAr: department.descriptionAr ?? "",
        descriptionEn: department.descriptionEn ?? "",
        icon: department.icon ?? "",
        sortOrder: department.sortOrder ?? 0,
        isActive: department.isActive,
        isVisible: department.isVisible,
      })
    }
  }, [department, isEdit, form])

  const onSubmit = form.handleSubmit(async (data) => {
    try {
      if (isEdit) {
        await updateMut.mutateAsync({
          id: department!.id,
          nameAr: data.nameAr,
          nameEn: data.nameEn,
          descriptionAr: data.descriptionAr || undefined,
          descriptionEn: data.descriptionEn || undefined,
          icon: data.icon || undefined,
          sortOrder: data.sortOrder,
          isActive: data.isActive,
          isVisible: data.isVisible,
        })
        toast.success(t("departments.edit.success"))
      } else {
        await createMut.mutateAsync({
          nameAr: data.nameAr,
          nameEn: data.nameEn,
          descriptionAr: data.descriptionAr || undefined,
          descriptionEn: data.descriptionEn || undefined,
          icon: data.icon || undefined,
          sortOrder: data.sortOrder,
          isActive: data.isActive,
          isVisible: data.isVisible,
        })
        toast.success(t("departments.create.success"))
      }
      router.push("/departments")
    } catch (err) {
      if (err instanceof ApiError && err.code === "DEPARTMENT_NAME_EXISTS") {
        toast.error(t("departments.create.duplicate"))
      } else {
        toast.error(
          err instanceof Error
            ? err.message
            : t(isEdit ? "departments.edit.error" : "departments.create.error"),
        )
      }
    }
  })

  const title = isEdit ? t("departments.edit.title") : t("departments.create.title")
  const description = isEdit
    ? (department?.nameAr ?? "")
    : t("departments.create.description")
  const submitLabel = isPending
    ? t(isEdit ? "departments.edit.submitting" : "departments.create.submitting")
    : t(isEdit ? "departments.edit.submit" : "departments.create.submit")
  const cancelLabel = t(isEdit ? "departments.edit.cancel" : "departments.create.cancel")

  if (isEdit && isLoading) {
    return (
      <ListPageShell>
        <Skeleton className="h-8 w-48" />
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={`skeleton-${i}`} className="h-48 w-full rounded-xl" />
          ))}
        </div>
      </ListPageShell>
    )
  }

  if (isEdit && !isLoading && !department) {
    return (
      <ListPageShell>
        <Breadcrumbs />
        <p className="text-muted-foreground">{t("departments.edit.notFound")}</p>
      </ListPageShell>
    )
  }

  return (
    <ListPageShell>
      <Breadcrumbs />

      <PageHeader title={title} description={description} />

      <form onSubmit={onSubmit} className="flex flex-col gap-5 pb-24">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="dept-nameAr">{t("departments.field.nameAr")} *</Label>
            <Input
              id="dept-nameAr"
              aria-invalid={form.formState.errors.nameAr ? "true" : undefined}
              aria-describedby={form.formState.errors.nameAr ? "dept-nameAr-error" : undefined}
              {...form.register("nameAr")}
            />
            {form.formState.errors.nameAr && (
              <p id="dept-nameAr-error" className="text-xs text-destructive">
                {t(form.formState.errors.nameAr.message ?? "")}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="dept-nameEn">{t("departments.field.nameEn")} *</Label>
            <Input
              id="dept-nameEn"
              aria-invalid={form.formState.errors.nameEn ? "true" : undefined}
              aria-describedby={form.formState.errors.nameEn ? "dept-nameEn-error" : undefined}
              {...form.register("nameEn")}
            />
            {form.formState.errors.nameEn && (
              <p id="dept-nameEn-error" className="text-xs text-destructive">
                {t(form.formState.errors.nameEn.message ?? "")}
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="dept-descriptionAr">{t("departments.field.descriptionAr")}</Label>
            <Input
              id="dept-descriptionAr"
              aria-invalid={form.formState.errors.descriptionAr ? "true" : undefined}
              aria-describedby={form.formState.errors.descriptionAr ? "dept-descriptionAr-error" : undefined}
              {...form.register("descriptionAr")}
            />
            {form.formState.errors.descriptionAr && (
              <p id="dept-descriptionAr-error" className="text-xs text-destructive">
                {t(form.formState.errors.descriptionAr.message ?? "")}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="dept-descriptionEn">{t("departments.field.descriptionEn")}</Label>
            <Input
              id="dept-descriptionEn"
              aria-invalid={form.formState.errors.descriptionEn ? "true" : undefined}
              aria-describedby={form.formState.errors.descriptionEn ? "dept-descriptionEn-error" : undefined}
              {...form.register("descriptionEn")}
            />
            {form.formState.errors.descriptionEn && (
              <p id="dept-descriptionEn-error" className="text-xs text-destructive">
                {t(form.formState.errors.descriptionEn.message ?? "")}
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="dept-icon">{t("departments.field.icon")}</Label>
            <Input
              id="dept-icon"
              aria-invalid={form.formState.errors.icon ? "true" : undefined}
              aria-describedby={form.formState.errors.icon ? "dept-icon-error" : undefined}
              {...form.register("icon")}
              placeholder={t("departments.field.iconPlaceholder")}
            />
            {form.formState.errors.icon && (
              <p id="dept-icon-error" className="text-xs text-destructive">
                {t(form.formState.errors.icon.message ?? "")}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="dept-sortOrder">{t("departments.field.sortOrder")}</Label>
            <Input
              id="dept-sortOrder"
              type="number"
              min={0}
              max={9999}
              aria-invalid={form.formState.errors.sortOrder ? "true" : undefined}
              aria-describedby={form.formState.errors.sortOrder ? "dept-sortOrder-error" : undefined}
              {...form.register("sortOrder", { valueAsNumber: true })}
              className="h-9 text-sm tabular-nums"
            />
            {form.formState.errors.sortOrder && (
              <p id="dept-sortOrder-error" className="text-xs text-destructive">
                {t(form.formState.errors.sortOrder.message ?? "")}
              </p>
            )}
          </div>
        </div>

        <Separator />

        <div className="flex items-center justify-between rounded-lg border p-3">
          <Label htmlFor="dept-active" className="cursor-pointer">
            {t("departments.field.isActive")}
          </Label>
          <Switch
            id="dept-active"
            checked={form.watch("isActive")}
            onCheckedChange={(v) => form.setValue("isActive", v)}
          />
        </div>

        <div className="flex items-center justify-between rounded-lg border p-3">
          <div className="flex flex-col gap-0.5">
            <Label htmlFor="dept-visible" className="cursor-pointer">
              {t("departments.isVisible")}
            </Label>
            <span className="text-xs text-muted-foreground">
              {t("departments.isVisibleDesc")}
            </span>
          </div>
          <Switch
            id="dept-visible"
            checked={form.watch("isVisible")}
            onCheckedChange={(v) => form.setValue("isVisible", v)}
          />
        </div>
      </form>

      <div className="sticky bottom-0 z-10 -mx-4 sm:-mx-6 border-t border-border bg-background px-4 sm:px-6 py-3 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="ghost"
          size="lg"
          className="rounded-lg"
          onClick={() => router.push("/departments")}
        >
          {cancelLabel}
        </Button>
        <Button
          type="submit"
          size="lg"
          className="rounded-lg"
          disabled={isPending}
          onClick={onSubmit}
        >
          {submitLabel}
        </Button>
      </div>
    </ListPageShell>
  )
}
