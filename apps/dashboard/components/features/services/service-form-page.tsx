// EXCEPTION: service create/edit form with tightly coupled tab state; all tabs mutate the same draft; 358 lines approved 2026-06-19
"use client"

import { useState, useEffect, useRef, startTransition } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useForm, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { showApiError } from "@/lib/mutation-helpers"
import { useQuery } from "@tanstack/react-query"

import { ListPageShell } from "@/components/features/list-page-shell"
import { Breadcrumbs } from "@/components/features/breadcrumbs"
import { Button, Skeleton } from "@sawaa/ui"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@sawaa/ui"
import { BasicInfoTab } from "@/components/features/services/create/basic-info-tab"
import { ServiceCategoryContextNotice } from "@/components/features/services/service-category-context-notice"
import { ServiceFormActions } from "@/components/features/services/service-form-actions"
import { ServiceFormPageHeader } from "@/components/features/services/service-form-page-header"
import { PricingTab } from "@/components/features/services/create/pricing-tab"
import { BookingSettingsTab } from "@/components/features/services/create/booking-settings-tab"
import { ServiceEmployeesTab } from "@/components/features/services/service-employees-tab"
import {
  createServiceSchema,
  createServiceEditSchema,
  createServiceDefaults,
  type CreateServiceFormData,
} from "@/components/features/services/create/form-schema"
import {
  mergeDraftsFromServer,
  type DraftBookingType,
} from "@/components/features/services/booking-types-editor"
import {
  useServiceMutations,
  useServiceBookingTypesMutation,
  useServiceBookingTypes,
} from "@/hooks/use-services"
import { useServiceCreateCategoryContext } from "@/components/features/services/use-service-create-category-context"
import { createResumableSave } from "@/lib/catalog-creation"
import type { Service } from "@/lib/types/service"
import { fetchService } from "@/lib/api/services"
import { formatRef } from "@/lib/utils"
import { useLocale } from "@/components/locale-provider"
import { queryKeys } from "@/lib/query-keys"
import {
  buildPayload,
  buildServiceEditPayload,
  saveBookingTypesApi,
  saveBookingTypesMutation,
} from "@/components/features/services/service-form-helpers"
import { uploadServiceImage } from "@/lib/api/services"
import { saveCreatedServiceEmployees } from "@/lib/service-creation"
import { sarToHalalas, halalasToSar } from "@/lib/money"
import { isDirectClinicBookingService } from "@/lib/service-catalog"
import { canSubmitCreateCategoryContext, categoryServicesReturnPath } from "@/components/features/services/service-form-context"

// DB-10: enum values are now uppercase
const EMPTY_BOOKING_TYPES: DraftBookingType[] = [
  { deliveryType: "IN_PERSON", enabled: true, price: 0, durationMins: 30, useCustomAvailability: false, availabilityWindows: [], durationOptions: [], defaultOptionId: undefined },
  { deliveryType: "ONLINE", enabled: false, price: 0, durationMins: 30, useCustomAvailability: false, availabilityWindows: [], durationOptions: [], defaultOptionId: undefined },
]

interface ServiceFormPageProps { mode: "create" | "edit"; serviceId?: string }

/* ─── Component ─── */

export function ServiceFormPage({ mode, serviceId }: ServiceFormPageProps) {
  const { t, locale } = useLocale()
  const isAr = locale === "ar"
  const router = useRouter()
  const searchParams = useSearchParams()
  const isEdit = mode === "edit"
  const tab = searchParams.get("tab")
  const initialTab = tab && ["basic", "pricing", "booking", "employees"].includes(tab) ? tab : "basic"
  const [activeTab, setActiveTab] = useState(initialTab)

  /* ── Data fetching (edit only) ── */
  const { data: service, isLoading, isError } = useQuery({
    queryKey: queryKeys.services.detail(serviceId ?? ""),
    queryFn: () => fetchService(serviceId!),
    enabled: isEdit && !!serviceId,
    retry: false,
  })

  // Canonical UUID resolved from the fetched record — the route param may be a
  // readable ref (e.g. SVC-12), but all downstream endpoints expect the UUID.
  const apiServiceId = service?.id ?? ""

  const { data: existingBookingTypes } = useServiceBookingTypes(apiServiceId)
  const hasCategoryContext = searchParams.has("categoryId")

  /* ── Mutations ── */
  const { createMut, updateMut } = useServiceMutations()
  const bookingTypesMutation = useServiceBookingTypesMutation(apiServiceId)

  /* ── Local state ── */
  const [bookingTypes, setBookingTypes] = useState<DraftBookingType[]>(EMPTY_BOOKING_TYPES)
  const [bookingTypesDirty, setBookingTypesDirty] = useState(false)
  const [pendingEmployeeIds, setPendingEmployeeIds] = useState<string[]>([])
  const [pendingActive, setPendingActive] = useState<Record<string, boolean>>({})
  const submitting = useRef(false)
  const creation = useRef(createResumableSave<Service>())
  const [isSubmitting, setIsSubmitting] = useState(false)
  const pendingAvatarFile = useRef<File | null>(null)

  /* ── Form ── */
  const form = useForm<CreateServiceFormData>({
    resolver: zodResolver(isEdit ? createServiceEditSchema(service?.nameEn) : createServiceSchema) as Resolver<CreateServiceFormData>,
    defaultValues: createServiceDefaults,
  })
  const { categories: allCategories, context: categoryContext, validCategory: validCategoryContext } = useServiceCreateCategoryContext(
    searchParams.get("categoryId"),
    hasCategoryContext,
    isEdit,
    form,
  )

  /* ── Populate form on edit ── */
  useEffect(() => {
    if (!service || !isEdit) return
    form.reset({
      nameEn: service.nameEn ?? "",
      nameAr: service.nameAr,
      descriptionEn: service.descriptionEn ?? "",
      descriptionAr: service.descriptionAr ?? "",
      categoryId: service.categoryId ?? "",
      isActive: service.isActive,
      isHidden: service.isHidden,
      hidePriceOnBooking: service.hidePriceOnBooking,
      hideDurationOnBooking: service.hideDurationOnBooking,
      iconName: service.iconName ?? null,
      iconBgColor: service.iconBgColor ?? null,
      imageUrl: service.imageUrl ?? null,
      bufferMinutes: service.bufferMinutes ?? undefined,
      depositEnabled: service.depositEnabled,
      depositAmount: service.depositAmount != null ? halalasToSar(service.depositAmount) : null,
      minLeadMinutes: service.minLeadMinutes ?? null,
      maxAdvanceDays: service.maxAdvanceDays ?? null,
    })
  }, [service, isEdit, form])

  /* ── Populate booking types on edit ── */
  useEffect(() => {
    if (!existingBookingTypes || bookingTypesDirty || !isEdit) return
    startTransition(() => setBookingTypes(mergeDraftsFromServer(existingBookingTypes)))
  }, [existingBookingTypes, bookingTypesDirty, isEdit])

  const handleBookingTypesChange = (types: DraftBookingType[]) => {
    setBookingTypes(types)
    if (isEdit) setBookingTypesDirty(true)
  }

  /* ── Submit ── */
  const handleSubmit = async (data: CreateServiceFormData) => {
    if (!isEdit && !canSubmitCreateCategoryContext(hasCategoryContext, categoryContext?.status)) return
    if (submitting.current) return
    submitting.current = true
    setIsSubmitting(true)
    try {
      if (isEdit && service) {
        const firstEnabled = bookingTypes.find((bt) => bt.enabled)
        await updateMut.mutateAsync({
          id: service.id,
          ...buildServiceEditPayload(data, isInternalService, service.nameEn),
          imageUrl: pendingAvatarFile.current || data.imageUrl?.startsWith("blob:") || data.imageUrl === service.imageUrl
            ? undefined
            : data.imageUrl,
          price: firstEnabled ? sarToHalalas(firstEnabled.price) : undefined,
          durationMins: firstEnabled ? firstEnabled.durationMins : undefined,
        })

        if (pendingAvatarFile.current) {
          await uploadServiceImage(service.id, pendingAvatarFile.current)
          pendingAvatarFile.current = null
        }

        if (bookingTypesDirty) {
          await saveBookingTypesMutation(service.id, bookingTypes, bookingTypesMutation)
        }

        toast.success(t("services.edit.success"))
      } else {
        const firstEnabled = bookingTypes.find((bt) => bt.enabled)
        const payload = {
          ...buildPayload(data), categoryId: data.categoryId ?? "",
          price: firstEnabled ? sarToHalalas(firstEnabled.price) : 0,
          durationMins: firstEnabled ? firstEnabled.durationMins : 30,
        }
        await creation.current.run({
          create: () => createMut.mutateAsync(payload),
          resume: (record) => updateMut.mutateAsync({id: record.id, ...payload}),
          complete: async (record) => {
            if (pendingAvatarFile.current) {
              await uploadServiceImage(record.id, pendingAvatarFile.current)
              pendingAvatarFile.current = null
            }
            await saveBookingTypesApi(record.id, bookingTypes)
            await saveCreatedServiceEmployees(record.id, pendingEmployeeIds, pendingActive)
          },
        })
        toast.success(t("services.create.success"))
      }

      router.push(validCategoryContext ? categoryServicesReturnPath(validCategoryContext) : "/services")
    } catch (err) {
      const key = isEdit ? "services.edit.error" : "services.create.error"
      showApiError(err, { fallback: t(key), t })
    } finally {
      submitting.current = false
      setIsSubmitting(false)
    }
  }

  const onSubmit = form.handleSubmit(handleSubmit, (errors) => {
    const firstError = Object.values(errors)[0] as { message?: string } | undefined
    toast.error(firstError?.message ?? t("services.formError"))
  })
  /* ── Loading / Error states (edit only) ── */
  if (isEdit && isLoading) {
    return (
      <ListPageShell>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64 mt-2" />
        <div className="mt-6 space-y-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </ListPageShell>
    )
  }

  if (isEdit && (isError || !service)) {
    return (
      <ListPageShell>
        <Breadcrumbs />
        <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
          <p className="text-sm font-semibold text-foreground">
            {t("services.notFound.title")}
          </p>
          <p className="text-sm text-muted-foreground">
            {t("services.notFound.desc")}
          </p>
          <Button variant="outline" onClick={() => router.push("/services")}>
            {t("services.notFound.back")}
          </Button>
        </div>
      </ListPageShell>
    )
  }

  const watchedCategoryId = form.watch("categoryId")
  const selectedCategory = allCategories.find(
    (c) => c.id === (watchedCategoryId || service?.categoryId)
  ) ?? service?.category ?? null

  const submitLabel = isSubmitting
    ? t(isEdit ? "services.edit.submitting" : "services.create.submitting")
    : t(isEdit ? "services.edit.submit" : "services.create.submit")
  const isInternalService = Boolean(isEdit && service && isDirectClinicBookingService(service))
  const clinicManagementHref = selectedCategory?.ref
    ? `/categories/${formatRef("CAT", selectedCategory.ref)}/edit?tab=info`
    : "/categories"
  const contextReturnPath = validCategoryContext ? categoryServicesReturnPath(validCategoryContext) : null
  const categoryContextHref = categoryContext?.status === "direct"
    ? `/categories/${formatRef("CAT", categoryContext.category.ref)}/edit?tab=info`
    : "/categories"

  return (
    <ListPageShell>
      <ServiceFormPageHeader isEdit={isEdit} service={service} categories={allCategories} categoryId={watchedCategoryId} />

      {hasCategoryContext && categoryContext && <ServiceCategoryContextNotice context={categoryContext} />}

      <form onSubmit={onSubmit} className="flex flex-col gap-6 pb-24">
        <fieldset disabled={isSubmitting} className="contents">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="overflow-x-auto pb-1 -mb-1">
            <TabsList className="min-w-max">
              <TabsTrigger value="basic" className="text-xs sm:text-sm">{t("services.create.tabs.basic")}</TabsTrigger>
              <TabsTrigger value="pricing" className="text-xs sm:text-sm">{t("services.create.tabs.pricing")}</TabsTrigger>
              <TabsTrigger value="booking" className="text-xs sm:text-sm">{t("services.create.tabs.booking")}</TabsTrigger>
              <TabsTrigger value="employees" className="text-xs sm:text-sm">{t("services.tabs.employees")}</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="basic" className="pt-4 space-y-4">
            <BasicInfoTab
              form={form}
              onImageSelect={(file) => { pendingAvatarFile.current = file }}
              serviceId={service?.id}
              isEdit={isEdit}
              isInternalService={isInternalService}
              internalCategoryName={selectedCategory ? (isAr ? selectedCategory.nameAr : (selectedCategory.nameEn ?? selectedCategory.nameAr)) : undefined}
              savedCategoryId={service?.categoryId}
              savedCategoryName={service?.category ? (isAr ? service.category.nameAr : (service.category.nameEn ?? service.category.nameAr)) : undefined}
              clinicManagementHref={clinicManagementHref}
            />
          </TabsContent>

          <TabsContent value="pricing" className="pt-4">
            <PricingTab
              bookingTypes={bookingTypes}
              onBookingTypesChange={handleBookingTypesChange}
            />
          </TabsContent>

          <TabsContent value="booking" className="pt-4">
            <BookingSettingsTab form={form} />
          </TabsContent>

          <TabsContent value="employees" className="pt-4">
            <ServiceEmployeesTab
              serviceId={service?.id}
              isCreate={!isEdit}
              pendingIds={pendingEmployeeIds}
              onPendingChange={setPendingEmployeeIds}
              serviceNameAr={service?.nameAr ?? form.watch("nameAr") ?? ""}
              serviceNameEn={service?.nameEn ?? form.watch("nameEn") ?? ""}
              pendingActive={pendingActive}
              onPendingActiveChange={setPendingActive}
            />
          </TabsContent>

        </Tabs>
        </fieldset>

        <ServiceFormActions
          cancelLabel={t(isEdit ? "services.edit.cancel" : "services.create.cancel")}
          submitLabel={submitLabel}
          isSubmitting={isSubmitting}
          isSubmitBlocked={!isEdit && !canSubmitCreateCategoryContext(hasCategoryContext, categoryContext?.status)}
          onCancel={() => router.push(contextReturnPath ?? (hasCategoryContext ? categoryContextHref : "/services"))}
        />
      </form>
    </ListPageShell>
  )
}
