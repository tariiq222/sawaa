"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useForm, Controller, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"

import { useCategories, useCategoryMutations } from "@/hooks/use-services"
import { useDepartmentOptions } from "@/hooks/use-departments"
import { ListPageShell } from "@/components/features/list-page-shell"
import { PageHeader } from "@/components/features/page-header"
import { Breadcrumbs } from "@/components/features/breadcrumbs"
import {
  Button, Skeleton, Tabs, TabsList, TabsTrigger, TabsContent,
  Input, Label, Switch, Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue, RadioGroup, RadioGroupItem,
} from "@sawaa/ui"
import { useLocale } from "@/components/locale-provider"
import {
  createCategorySchema, editCategorySchema,
  type CreateCategoryFormData, type EditCategoryFormData,
} from "@/lib/schemas/service.schema"
import type { ServiceCategory } from "@/lib/types/service"
import { CategorySettingsTab } from "./category-settings-tab"
import { CategoryServicesTab } from "./category-services-tab"
import { CategoryEmployeesTab } from "./category-employees-tab"

interface CategoryFormPageProps {
  mode: "create" | "edit"
  categoryId?: string
}

function Field({ label, required, children, error }: {
  label: string; required?: boolean; children: React.ReactNode; error?: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}{required && <span className="ms-0.5 text-destructive">*</span>}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

export function CategoryFormPage({ mode, categoryId }: CategoryFormPageProps) {
  const { t, locale } = useLocale()
  const router = useRouter()
  const isAr = locale === "ar"
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { data: allCategories, isLoading: categoriesLoading } = useCategories()
  const { createMut, updateMut } = useCategoryMutations()
  const { options: departmentOptions } = useDepartmentOptions()

  const category: ServiceCategory | undefined =
    mode === "edit" && categoryId ? allCategories?.find((c) => c.id === categoryId) : undefined

  const form = useForm<EditCategoryFormData>({
    resolver: zodResolver(mode === "edit" ? editCategorySchema : createCategorySchema) as Resolver<EditCategoryFormData>,
    defaultValues: { nameAr: "", nameEn: "", sortOrder: undefined, isActive: true, departmentId: "", bookingMode: "DIRECT" as const },
  })
  const { register, handleSubmit, control, reset, formState: { errors } } = form
  const watchedMode = form.watch("bookingMode")
  const effectiveMode = mode === "edit" ? (category?.bookingMode ?? watchedMode ?? "DIRECT") : (watchedMode ?? "DIRECT")

  useEffect(() => {
    if (mode === "edit" && category) {
      reset({
        nameAr: category.nameAr,
        nameEn: category.nameEn ?? "",
        sortOrder: category.sortOrder,
        isActive: category.isActive,
        departmentId: category.departmentId ?? "",
        bookingMode: category.bookingMode ?? "DIRECT",
      })
    }
  }, [mode, category, reset])

  const onSubmit = async (data: EditCategoryFormData) => {
    setIsSubmitting(true)
    try {
      const deptId = !data.departmentId || data.departmentId === "__none__" ? undefined : data.departmentId
      if (mode === "create") {
        await createMut.mutateAsync({ nameAr: data.nameAr!, nameEn: data.nameEn || undefined, sortOrder: data.sortOrder, departmentId: deptId, bookingMode: data.bookingMode } as CreateCategoryFormData)
        toast.success(t("services.categories.create.success"))
      } else {
        await updateMut.mutateAsync({ id: categoryId!, nameAr: data.nameAr, nameEn: data.nameEn || undefined, sortOrder: data.sortOrder, isActive: data.isActive, departmentId: deptId ?? null, bookingMode: data.bookingMode })
        toast.success(t("services.categories.edit.success"))
      }
      router.push("/categories")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t(mode === "create" ? "services.categories.create.error" : "services.categories.edit.error"))
    } finally {
      setIsSubmitting(false)
    }
  }

  if (mode === "edit" && categoriesLoading) {
    return (
      <ListPageShell>
        <div className="space-y-4">
          <Skeleton className="h-6 w-48 rounded" />
          <Skeleton className="h-8 w-72 rounded" />
          <Skeleton className="h-8 rounded" />
          <Skeleton className="h-8 rounded" />
        </div>
      </ListPageShell>
    )
  }

  if (mode === "edit" && !categoriesLoading && !category) {
    return (
      <ListPageShell>
        <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
          <h2 className="text-xl font-semibold text-foreground">{t("services.categories.page.notFound.title")}</h2>
          <p className="text-sm text-muted-foreground">{t("services.categories.page.notFound.desc")}</p>
          <Button variant="outline" onClick={() => router.push("/categories")}>{t("services.categories.page.notFound.back")}</Button>
        </div>
      </ListPageShell>
    )
  }

  const breadcrumbItems = mode === "edit" && category
    ? [
        { label: t("nav.dashboard"), href: "/" },
        { label: t("nav.categories"), href: "/categories" },
        { label: isAr ? category.nameAr : (category.nameEn ?? category.nameAr), href: `/categories/${category.id}/edit` },
        { label: t("nav.edit") },
      ]
    : [
        { label: t("nav.dashboard"), href: "/" },
        { label: t("nav.categories"), href: "/categories" },
        { label: t("nav.create") },
      ]

  return (
    <ListPageShell>
      <Breadcrumbs items={breadcrumbItems} />
      <PageHeader
        title={mode === "edit" ? t("services.categories.edit.title") : t("services.categories.create.title")}
        description={mode === "edit" ? t("services.categories.edit.description") : t("services.categories.create.description")}
      />

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6 pb-24">
        <Tabs defaultValue="info">
          {effectiveMode === "SERVICES" ? (
            <TabsList>
              <TabsTrigger value="info">{t("services.categories.page.tabs.info")}</TabsTrigger>
              <TabsTrigger value="services" disabled={mode === "create"}>{t("services.categories.page.tabs.services")}</TabsTrigger>
            </TabsList>
          ) : (
            <TabsList>
              <TabsTrigger value="info">{t("services.categories.page.tabs.info")}</TabsTrigger>
              <TabsTrigger value="settings" disabled={mode === "create"}>{t("services.categories.page.tabs.settings")}</TabsTrigger>
              <TabsTrigger value="employees" disabled={mode === "create"}>{t("services.categories.page.tabs.employees")}</TabsTrigger>
            </TabsList>
          )}

          <TabsContent value="info" className="mt-6 flex flex-col gap-5">
            <Field label={t("services.categories.create.nameAr")} required error={errors.nameAr ? t(errors.nameAr.message ?? "common.required") : undefined}>
              <Input id="nameAr" {...register("nameAr")} placeholder={t("services.categories.create.nameAr")} />
            </Field>

            <Field label={t("services.categories.create.nameEn")}>
              <Input id="nameEn" {...register("nameEn")} placeholder={t("services.categories.create.nameEn")} />
            </Field>

            <Field label={t("services.categories.bookingMode.label")}>
              <Controller
                control={control}
                name="bookingMode"
                render={({ field }) => (
                  <RadioGroup
                    value={field.value ?? "DIRECT"}
                    onValueChange={field.onChange}
                    className="flex flex-col gap-3"
                  >
                    <div className="flex items-start gap-3 rounded-lg border border-border p-3 cursor-pointer has-[:checked]:border-primary">
                      <RadioGroupItem value="DIRECT" id="page-mode-direct" className="mt-0.5" />
                      <label htmlFor="page-mode-direct" className="flex flex-col gap-0.5 cursor-pointer">
                        <span className="text-sm font-medium">{t("services.categories.bookingMode.direct")}</span>
                        <span className="text-xs text-muted-foreground">{t("services.categories.bookingMode.directDesc")}</span>
                      </label>
                    </div>
                    <div className="flex items-start gap-3 rounded-lg border border-border p-3 cursor-pointer has-[:checked]:border-primary">
                      <RadioGroupItem value="SERVICES" id="page-mode-services" className="mt-0.5" />
                      <label htmlFor="page-mode-services" className="flex flex-col gap-0.5 cursor-pointer">
                        <span className="text-sm font-medium">{t("services.categories.bookingMode.services")}</span>
                        <span className="text-xs text-muted-foreground">{t("services.categories.bookingMode.servicesDesc")}</span>
                      </label>
                    </div>
                  </RadioGroup>
                )}
              />
              {mode === "edit" && (
                <p className="text-xs text-muted-foreground mt-1">{t("services.categories.bookingMode.editHint")}</p>
              )}
            </Field>

            <Field label={t("services.categories.create.department")}>
              <Controller
                name="departmentId"
                control={control}
                render={({ field }) => (
                  <Select value={field.value ?? ""} onValueChange={(v) => field.onChange(v === "__none__" ? "" : v)}>
                    <SelectTrigger><SelectValue placeholder={t("services.categories.create.departmentPlaceholder")} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">{t("services.categories.create.departmentPlaceholder")}</SelectItem>
                      {departmentOptions.map((dept) => (
                        <SelectItem key={dept.id} value={dept.id}>
                          {isAr ? dept.nameAr : (dept.nameEn ?? dept.nameAr)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>

            <Field label={t("services.categories.create.sortOrder")}>
              <Input id="sortOrder" type="number" min={0} max={999} {...register("sortOrder")} placeholder="0" className="w-32" />
            </Field>

            {mode === "edit" && (
              <div className="flex items-center gap-3">
                <Controller
                  name="isActive"
                  control={control}
                  render={({ field }) => (
                    <Switch id="isActive" checked={field.value ?? true} onCheckedChange={field.onChange} />
                  )}
                />
                <Label htmlFor="isActive">{t("services.categories.edit.isActive")}</Label>
              </div>
            )}
          </TabsContent>

          {effectiveMode === "SERVICES" ? (
            <TabsContent value="services" className="mt-6">
              <CategoryServicesTab categoryId={categoryId} />
            </TabsContent>
          ) : (
            <>
              <TabsContent value="settings" className="mt-6">
                <CategorySettingsTab
                  categoryId={categoryId}
                  mode={mode}
                  categoryNameAr={category?.nameAr ?? ""}
                  bookingMode={effectiveMode}
                />
              </TabsContent>
              <TabsContent value="employees" className="mt-6">
                <CategoryEmployeesTab categoryId={categoryId} mode={mode} />
              </TabsContent>
            </>
          )}
        </Tabs>

        <div className="sticky bottom-0 z-10 -mx-4 sm:-mx-6 border-t border-border bg-background px-4 sm:px-6 py-3 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={() => router.push("/categories")}>
            {t("services.categories.edit.cancel")}
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? t("services.categories.edit.submitting") : mode === "edit" ? t("services.categories.edit.submit") : t("services.categories.create.submit")}
          </Button>
        </div>
      </form>
    </ListPageShell>
  )
}
