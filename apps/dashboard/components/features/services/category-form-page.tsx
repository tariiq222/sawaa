"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
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
import { ServiceAvatarPicker } from "./service-avatar-picker"

interface CategoryFormPageProps {
  mode: "create" | "edit"
  categoryId?: string
}

function Field({ label, required, children, error, className }: {
  label: string; required?: boolean; children: React.ReactNode; error?: string; className?: string
}) {
  return (
    <div className={`flex flex-col gap-1.5${className ? ` ${className}` : ""}`}>
      <Label>{label}{required && <span className="ms-0.5 text-destructive">*</span>}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

export function CategoryFormPage({ mode, categoryId }: CategoryFormPageProps) {
  const { t, locale } = useLocale()
  const router = useRouter()
  const searchParams = useSearchParams()
  const isAr = locale === "ar"
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [activeTab, setActiveTab] = useState<string>(searchParams.get("tab") ?? "info")

  const { data: allCategories, isLoading: categoriesLoading } = useCategories()
  const { createMut, updateMut } = useCategoryMutations()
  const { options: departmentOptions } = useDepartmentOptions()

  const category: ServiceCategory | undefined =
    mode === "edit" && categoryId ? allCategories?.find((c) => c.id === categoryId) : undefined

  const form = useForm<EditCategoryFormData>({
    resolver: zodResolver(
      (mode === "edit" ? editCategorySchema : createCategorySchema) as typeof editCategorySchema,
    ) as Resolver<EditCategoryFormData>,
    defaultValues: { nameAr: "", nameEn: "", sortOrder: undefined, isActive: true, departmentId: "", bookingMode: "DIRECT" as const, iconName: undefined, iconBgColor: undefined, imageUrl: undefined },
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
        iconName: category.iconName ?? undefined,
        iconBgColor: category.iconBgColor ?? undefined,
        imageUrl: category.imageUrl ?? undefined,
      })
    }
  }, [mode, category, reset])

  const buildCreatePayload = (data: EditCategoryFormData): CreateCategoryFormData => {
    const deptId = !data.departmentId || data.departmentId === "__none__" ? undefined : data.departmentId
    return { nameAr: data.nameAr!, nameEn: data.nameEn || undefined, sortOrder: data.sortOrder, departmentId: deptId, bookingMode: data.bookingMode ?? "DIRECT", iconName: data.iconName ?? undefined, iconBgColor: data.iconBgColor ?? undefined, imageUrl: data.imageUrl ?? undefined }
  }

  const saveAndGoToTab = async (target: string) => {
    if (!(await form.trigger())) return
    setIsSubmitting(true)
    try {
      const created = await createMut.mutateAsync(buildCreatePayload(form.getValues()))
      toast.success(t("services.categories.create.success"))
      router.push(`/categories/${created.id}/edit?tab=${target}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("services.categories.create.error"))
    } finally { setIsSubmitting(false) }
  }

  const onSubmit = async (data: EditCategoryFormData) => {
    setIsSubmitting(true)
    try {
      if (mode === "create") {
        const created = await createMut.mutateAsync(buildCreatePayload(data))
        toast.success(t("services.categories.create.success"))
        const secondTab = (data.bookingMode ?? "DIRECT") === "SERVICES" ? "services" : "settings"
        router.push(`/categories/${created.id}/edit?tab=${secondTab}`)
      } else {
        const deptId = !data.departmentId || data.departmentId === "__none__" ? undefined : data.departmentId
        await updateMut.mutateAsync({ id: categoryId!, nameAr: data.nameAr, nameEn: data.nameEn || undefined, sortOrder: data.sortOrder, isActive: data.isActive, departmentId: deptId ?? null, bookingMode: data.bookingMode, iconName: data.iconName ?? undefined, iconBgColor: data.iconBgColor ?? undefined, imageUrl: data.imageUrl ?? undefined })
        toast.success(t("services.categories.edit.success"))
        router.push("/categories")
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t(mode === "create" ? "services.categories.create.error" : "services.categories.edit.error"))
    } finally { setIsSubmitting(false) }
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
        <Tabs
          value={activeTab}
          onValueChange={(val) => {
            if (mode === "create" && val !== "info") {
              saveAndGoToTab(val)
            } else {
              setActiveTab(val)
            }
          }}
        >
          {effectiveMode === "SERVICES" ? (
            <TabsList>
              <TabsTrigger value="info">{t("services.categories.page.tabs.info")}</TabsTrigger>
              <TabsTrigger value="services">{t("services.categories.page.tabs.services")}</TabsTrigger>
            </TabsList>
          ) : (
            <TabsList>
              <TabsTrigger value="info">{t("services.categories.page.tabs.info")}</TabsTrigger>
              <TabsTrigger value="settings">{t("services.categories.page.tabs.settings")}</TabsTrigger>
              <TabsTrigger value="employees">{t("services.categories.page.tabs.employees")}</TabsTrigger>
            </TabsList>
          )}
          <TabsContent value="info" className="mt-6 flex flex-col gap-6">
            <section className="rounded-2xl border border-border bg-surface-solid p-6 shadow-sm">
              <h2 className="mb-5 text-xs font-bold uppercase tracking-wide text-muted-foreground">{t("services.categories.page.tabs.info")}</h2>
              {/* Avatar picker */}
              <div className="mb-5 flex items-center gap-4">
                <ServiceAvatarPicker
                  iconName={form.watch("iconName")}
                  iconBgColor={form.watch("iconBgColor")}
                  imageUrl={form.watch("imageUrl")}
                  serviceName={form.watch("nameAr") || form.watch("nameEn")}
                  onIconChange={(name, color) => {
                    form.setValue("iconName", name)
                    form.setValue("iconBgColor", color)
                    form.setValue("imageUrl", null)
                  }}
                  onImageChange={(file) => {
                    const url = URL.createObjectURL(file)
                    form.setValue("imageUrl", url)
                    form.setValue("iconName", null)
                    form.setValue("iconBgColor", null)
                  }}
                  onClear={() => {
                    form.setValue("iconName", null)
                    form.setValue("iconBgColor", null)
                    form.setValue("imageUrl", null)
                  }}
                />
                <div className="flex flex-col gap-0.5">
                  <p className="text-sm font-medium text-foreground">{t("services.categories.avatar.label")}</p>
                  <p className="text-xs text-muted-foreground">{t("services.categories.avatar.hint")}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                <Field label={t("services.categories.create.nameAr")} required error={errors.nameAr ? t(errors.nameAr.message ?? "common.required") : undefined}>
                  <Input id="nameAr" {...register("nameAr")} placeholder={t("services.categories.create.nameAr")} />
                </Field>
                <Field label={t("services.categories.create.nameEn")}>
                  <Input id="nameEn" {...register("nameEn")} placeholder={t("services.categories.create.nameEn")} />
                </Field>
                <Field label={t("services.categories.create.department")}>
                  <Controller
                    name="departmentId"
                    control={control}
                    render={({ field }) => (
                      <Select value={field.value ?? ""} onValueChange={(v) => field.onChange(v === "__none__" ? "" : v)}>
                        <SelectTrigger className="w-full"><SelectValue placeholder={t("services.categories.create.departmentPlaceholder")} /></SelectTrigger>
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
                  <Input id="sortOrder" type="number" min={0} max={999} {...register("sortOrder")} placeholder="0" />
                </Field>
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-surface-solid p-6 shadow-sm">
              <h2 className="mb-5 text-xs font-bold uppercase tracking-wide text-muted-foreground">{t("services.categories.bookingMode.label")}</h2>
              <Controller
                control={control}
                name="bookingMode"
                render={({ field }) => (
                  <RadioGroup
                    value={field.value ?? "DIRECT"}
                    onValueChange={field.onChange}
                    className="grid grid-cols-1 gap-3 sm:grid-cols-2"
                  >
                    <label htmlFor="page-mode-direct" className="flex cursor-pointer items-start gap-3 rounded-sm border border-border bg-surface p-4 transition-colors has-[:checked]:border-primary has-[:checked]:bg-surface-muted/40">
                      <RadioGroupItem value="DIRECT" id="page-mode-direct" className="mt-0.5" />
                      <span className="flex flex-col gap-1">
                        <span className="text-sm font-semibold text-foreground">{t("services.categories.bookingMode.direct")}</span>
                        <span className="text-xs text-muted-foreground">{t("services.categories.bookingMode.directDesc")}</span>
                      </span>
                    </label>
                    <label htmlFor="page-mode-services" className="flex cursor-pointer items-start gap-3 rounded-sm border border-border bg-surface p-4 transition-colors has-[:checked]:border-primary has-[:checked]:bg-surface-muted/40">
                      <RadioGroupItem value="SERVICES" id="page-mode-services" className="mt-0.5" />
                      <span className="flex flex-col gap-1">
                        <span className="text-sm font-semibold text-foreground">{t("services.categories.bookingMode.services")}</span>
                        <span className="text-xs text-muted-foreground">{t("services.categories.bookingMode.servicesDesc")}</span>
                      </span>
                    </label>
                  </RadioGroup>
                )}
              />
              {mode === "edit" && (
                <p className="mt-3 text-xs text-muted-foreground">{t("services.categories.bookingMode.editHint")}</p>
              )}
            </section>

            {mode === "edit" && (
              <section className="rounded-2xl border border-border bg-surface-solid p-6 shadow-sm">
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
              </section>
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
          <Button type="button" variant="ghost" size="lg" className="rounded-lg" onClick={() => router.push("/categories")}>
            {t("services.categories.edit.cancel")}
          </Button>
          <Button type="submit" size="lg" className="rounded-lg" disabled={isSubmitting}>
            {isSubmitting ? t("services.categories.edit.submitting") : mode === "edit" ? t("services.categories.edit.submit") : t("services.categories.create.submit")}
          </Button>
        </div>
      </form>
    </ListPageShell>
  )
}
