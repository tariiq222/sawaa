// EXCEPTION: 381 lines — multi-tab wizard with avatar upload, booking mode, and edit/create modes; approved 2026-06-19
"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useForm, Controller, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"

import { useCategories, useCategoryMutations } from "@/hooks/use-services"
import { useDepartmentOptions } from "@/hooks/use-departments"
import { ListPageShell } from "@/components/features/list-page-shell"
import { PageHeader } from "@/components/features/page-header"
import { Breadcrumbs } from "@/components/features/breadcrumbs"
import { FormSection, FormField } from "@/components/features/shared/form-section"
import {
  Button, Skeleton, Tabs, TabsContent,
  Input, Switch, Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue, RadioGroup, RadioGroupItem, Label,
} from "@sawaa/ui"
import { useLocale } from "@/components/locale-provider"
import {
  createCategorySchema, editCategorySchema,
  type CreateCategoryFormData, type EditCategoryFormData,
} from "@/lib/schemas/service.schema"
import type { ServiceCategory } from "@/lib/types/service"
import { formatRef } from "@/lib/utils"
import { uploadCategoryImage } from "@/lib/api/services"
import { CategorySettingsTab } from "./category-settings-tab"
import { CategoryServicesTab } from "./category-services-tab"
import { CategoryEmployeesTab } from "./category-employees-tab"
import { ServiceAvatarPicker } from "./service-avatar-picker"
import { CategoryWizardNav } from "./category-wizard-nav"
import { CategoryWizardStepper } from "./category-wizard-stepper"

interface CategoryFormPageProps {
  mode: "create" | "edit"
  categoryId?: string
}

export function CategoryFormPage({ mode, categoryId }: CategoryFormPageProps) {
  const { t, locale } = useLocale()
  const router = useRouter()
  const searchParams = useSearchParams()
  const isAr = locale === "ar"
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [activeTab, setActiveTab] = useState<string>(searchParams.get("tab") ?? "info")
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false)
  const pendingExit = useRef<(() => void) | null>(null)
  const pendingNextTab = useRef<string | null>(null)
  const pendingAvatarFile = useRef<File | null>(null)
  const [localAvatarPreview, setLocalAvatarPreview] = useState<string | null>(null)

  const { data: allCategories, isLoading: categoriesLoading } = useCategories()
  const { createMut, updateMut } = useCategoryMutations()
  const { options: departmentOptions } = useDepartmentOptions()

  const category: ServiceCategory | undefined =
    mode === "edit" && categoryId ? allCategories?.find((c) => c.id === categoryId || formatRef("CAT", c.ref) === categoryId) : undefined

  const form = useForm<EditCategoryFormData>({
    resolver: zodResolver(
      (mode === "edit" ? editCategorySchema : createCategorySchema) as typeof editCategorySchema,
    ) as Resolver<EditCategoryFormData>,
    defaultValues: { nameAr: "", nameEn: "", sortOrder: undefined, isActive: true, departmentId: "", bookingMode: "DIRECT" as const, iconName: undefined, iconBgColor: undefined, imageUrl: undefined },
  })
  const { register, handleSubmit, control, reset, formState: { errors } } = form
  const watchedMode = form.watch("bookingMode")
  const effectiveMode = mode === "edit" ? (category?.bookingMode ?? watchedMode ?? "DIRECT") : (watchedMode ?? "DIRECT")
  const tabs = effectiveMode === "SERVICES" ? ["info", "services"] : ["info", "settings", "employees"]
  const tabIndex = tabs.indexOf(activeTab)
  const isFirst = tabIndex === 0
  const isLast = tabIndex === tabs.length - 1
  const prevTab = tabIndex > 0 ? tabs[tabIndex - 1] : null
  const nextTab = tabIndex < tabs.length - 1 ? tabs[tabIndex + 1] : null

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
      pendingAvatarFile.current = null
      setLocalAvatarPreview(null)
    }
  }, [mode, category, reset])

  useEffect(() => {
    if (mode !== "edit" || !form.formState.isDirty) return
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [mode, form.formState.isDirty])

  const buildCreatePayload = (data: EditCategoryFormData): CreateCategoryFormData => {
    const deptId = !data.departmentId || data.departmentId === "__none__" ? undefined : data.departmentId
    // imageUrl is NOT included in create payload — uploaded separately after entity creation
    return { nameAr: data.nameAr!, nameEn: data.nameEn || undefined, sortOrder: data.sortOrder, departmentId: deptId, bookingMode: data.bookingMode ?? "DIRECT", iconName: data.iconName ?? undefined, iconBgColor: data.iconBgColor ?? undefined }
  }

  const saveAndGoToTab = async (target: string) => {
    if (!(await form.trigger())) return
    setIsSubmitting(true)
    try {
      const created = await createMut.mutateAsync(buildCreatePayload(form.getValues()))

      if (pendingAvatarFile.current) {
        await uploadCategoryImage(created.id, pendingAvatarFile.current)
        pendingAvatarFile.current = null
        setLocalAvatarPreview(null)
      }

      toast.success(t("services.categories.create.success"))
      router.push(`/categories/${formatRef("CAT", created.ref)}/edit?tab=${target}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("services.categories.create.error"))
    } finally { setIsSubmitting(false) }
  }

  const onSubmit = async (data: EditCategoryFormData) => {
    setIsSubmitting(true)
    try {
      if (mode === "create") {
        const created = await createMut.mutateAsync(buildCreatePayload(data))

        if (pendingAvatarFile.current) {
          await uploadCategoryImage(created.id, pendingAvatarFile.current)
          pendingAvatarFile.current = null
          setLocalAvatarPreview(null)
        }

        toast.success(t("services.categories.create.success"))
        const secondTab = (data.bookingMode ?? "DIRECT") === "SERVICES" ? "services" : "settings"
        router.push(`/categories/${formatRef("CAT", created.ref)}/edit?tab=${secondTab}`)
      } else {
        const deptId = !data.departmentId || data.departmentId === "__none__" ? undefined : data.departmentId
        // imageUrl in payload only when set from the server (not a pending file upload)
        const imageUrlValue = pendingAvatarFile.current ? undefined : (data.imageUrl ?? undefined)
        await updateMut.mutateAsync({ id: categoryId!, nameAr: data.nameAr, nameEn: data.nameEn || undefined, sortOrder: data.sortOrder, isActive: data.isActive, departmentId: deptId ?? null, bookingMode: data.bookingMode, iconName: data.iconName ?? undefined, iconBgColor: data.iconBgColor ?? undefined, imageUrl: imageUrlValue })

        if (pendingAvatarFile.current) {
          await uploadCategoryImage(categoryId!, pendingAvatarFile.current)
          pendingAvatarFile.current = null
          setLocalAvatarPreview(null)
        }

        toast.success(t("services.categories.edit.success"))
        if (pendingNextTab.current !== null) {
          reset({ ...data, departmentId: data.departmentId ?? "" })
          setActiveTab(pendingNextTab.current)
          pendingNextTab.current = null
        } else {
          router.push("/categories")
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t(mode === "create" ? "services.categories.create.error" : "services.categories.edit.error"))
    } finally { setIsSubmitting(false) }
  }

  const handleNext = () => {
    if (activeTab === "info") {
      if (mode === "create") {
        if (nextTab) saveAndGoToTab(nextTab)
      } else {
        pendingNextTab.current = nextTab
        handleSubmit(onSubmit)()
      }
    } else {
      if (nextTab) setActiveTab(nextTab)
    }
  }

  const handleBack = () => {
    if (prevTab) setActiveTab(prevTab)
  }

  const handleFinishOrCancel = (navigateFn: () => void) => {
    if (mode === "edit" && form.formState.isDirty) {
      pendingExit.current = navigateFn
      setExitConfirmOpen(true)
    } else {
      navigateFn()
    }
  }

  if (mode === "edit" && categoriesLoading) return (
    <ListPageShell><div className="space-y-4"><Skeleton className="h-6 w-48 rounded" /><Skeleton className="h-8 w-72 rounded" /><Skeleton className="h-8 rounded" /><Skeleton className="h-8 rounded" /></div></ListPageShell>
  )
  if (mode === "edit" && !categoriesLoading && !category) return (
    <ListPageShell>
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <h2 className="text-xl font-semibold text-foreground">{t("services.categories.page.notFound.title")}</h2>
        <p className="text-sm text-muted-foreground">{t("services.categories.page.notFound.desc")}</p>
        <Button variant="outline" onClick={() => router.push("/categories")}>{t("services.categories.page.notFound.back")}</Button>
      </div>
    </ListPageShell>
  )

  const base = [{ label: t("nav.dashboard"), href: "/" }, { label: t("nav.categories"), href: "/categories" }]
  const breadcrumbItems = mode === "edit" && category
    ? [...base, { label: isAr ? category.nameAr : (category.nameEn ?? category.nameAr), href: `/categories/${formatRef("CAT", category.ref)}/edit` }, { label: t("nav.edit") }]
    : [...base, { label: t("nav.create") }]

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
          <CategoryWizardStepper
            tabs={tabs}
            activeTab={activeTab}
            onTabChange={(val) => {
              if (mode === "create" && val !== "info") {
                saveAndGoToTab(val)
              } else {
                setActiveTab(val)
              }
            }}
            t={t}
          />
          <TabsContent value="info" className="mt-6 flex flex-col gap-6">
            <FormSection title={t("services.categories.page.tabs.info")}>
              {/* Avatar picker */}
              <div className="mb-5 flex items-center gap-4">
                <ServiceAvatarPicker
                  iconName={form.watch("iconName")}
                  iconBgColor={form.watch("iconBgColor")}
                  imageUrl={localAvatarPreview ?? form.watch("imageUrl")}
                  serviceName={form.watch("nameAr") || form.watch("nameEn")}
                  onIconChange={(name, color) => {
                    form.setValue("iconName", name)
                    form.setValue("iconBgColor", color)
                    form.setValue("imageUrl", null)
                    pendingAvatarFile.current = null
                    setLocalAvatarPreview(null)
                  }}
                  onImageChange={(file) => {
                    pendingAvatarFile.current = file
                    setLocalAvatarPreview(URL.createObjectURL(file))
                    form.setValue("iconName", null)
                    form.setValue("iconBgColor", null)
                  }}
                  onClear={() => {
                    form.setValue("iconName", null)
                    form.setValue("iconBgColor", null)
                    form.setValue("imageUrl", null)
                    pendingAvatarFile.current = null
                    setLocalAvatarPreview(null)
                  }}
                />
                <div className="flex flex-col gap-0.5">
                  <p className="text-sm font-medium text-foreground">{t("services.categories.avatar.label")}</p>
                  <p className="text-xs text-muted-foreground">{t("services.categories.avatar.hint")}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                <FormField label={t("services.categories.create.nameAr")} required error={errors.nameAr ? t(errors.nameAr.message ?? "common.required") : undefined}><Input id="nameAr" {...register("nameAr")} placeholder={t("services.categories.create.nameAr")} /></FormField>
                <FormField label={t("services.categories.create.nameEn")}><Input id="nameEn" {...register("nameEn")} placeholder={t("services.categories.create.nameEn")} /></FormField>
                <FormField label={t("services.categories.create.department")}>
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
                </FormField>
                <FormField label={t("services.categories.create.sortOrder")}><Input id="sortOrder" type="number" min={0} max={999} {...register("sortOrder", { valueAsNumber: true })} placeholder="0" /></FormField>
              </div>
            </FormSection>

            <FormSection title={t("services.categories.bookingMode.label")}>
              <Controller
                control={control}
                name="bookingMode"
                render={({ field }) => (
                  <RadioGroup
                    value={field.value ?? "DIRECT"}
                    onValueChange={field.onChange}
                    className="grid grid-cols-1 gap-3 sm:grid-cols-2"
                  >
                    {(["DIRECT", "SERVICES"] as const).map((bm) => (
                      <label key={bm} htmlFor={`page-mode-${bm.toLowerCase()}`} className="flex cursor-pointer items-start gap-3 rounded-sm border border-border bg-surface p-4 transition-colors has-[:checked]:border-primary has-[:checked]:bg-surface-muted/40">
                        <RadioGroupItem value={bm} id={`page-mode-${bm.toLowerCase()}`} className="mt-0.5" />
                        <span className="flex flex-col gap-1">
                          <span className="text-sm font-semibold text-foreground">{t(`services.categories.bookingMode.${bm === "DIRECT" ? "direct" : "services"}`)}</span>
                          <span className="text-xs text-muted-foreground">{t(`services.categories.bookingMode.${bm === "DIRECT" ? "directDesc" : "servicesDesc"}`)}</span>
                        </span>
                      </label>
                    ))}
                  </RadioGroup>
                )}
              />
              {mode === "edit" && (
                <p className="mt-3 text-xs text-muted-foreground">{t("services.categories.bookingMode.editHint")}</p>
              )}
            </FormSection>

            {mode === "edit" && (
              <FormSection>
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
              </FormSection>
            )}
          </TabsContent>

          {effectiveMode === "SERVICES" ? (
            <TabsContent value="services" className="mt-6">
              <CategoryServicesTab categoryId={category?.id} />
            </TabsContent>
          ) : (
            <>
              <TabsContent value="settings" className="mt-6">
                <CategorySettingsTab
                  categoryId={category?.id}
                  mode={mode}
                  categoryNameAr={category?.nameAr ?? ""}
                  bookingMode={effectiveMode}
                />
              </TabsContent>
              <TabsContent value="employees" className="mt-6">
                <CategoryEmployeesTab categoryId={category?.id} mode={mode} />
              </TabsContent>
            </>
          )}
        </Tabs>
        <CategoryWizardNav
          mode={mode}
          isFirst={isFirst}
          isLast={isLast}
          isSubmitting={isSubmitting}
          isDirty={form.formState.isDirty}
          exitConfirmOpen={exitConfirmOpen}
          onNext={handleNext}
          onBack={handleBack}
          onCancel={() => handleFinishOrCancel(() => router.push("/categories"))}
          onFinish={() => {
            if (activeTab === "info") {
              handleSubmit(onSubmit)()
            } else {
              handleFinishOrCancel(() => router.push("/categories"))
            }
          }}
          onExitConfirm={() => { pendingExit.current?.(); pendingExit.current = null; setExitConfirmOpen(false) }}
          onExitCancel={() => setExitConfirmOpen(false)}
          t={t}
        />
      </form>
    </ListPageShell>
  )
}
