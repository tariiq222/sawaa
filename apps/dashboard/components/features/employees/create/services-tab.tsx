"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon } from "@hugeicons/core-free-icons"

import { Button } from "@sawaa/ui"
import { useLocale } from "@/components/locale-provider"
import { FormSection } from "@/components/features/shared/form-section"
import { useServiceBookingTypes, useServices } from "@/hooks/use-services"
import { useEmployeeServiceTypes } from "@/hooks/use-employees"
import type { EmployeeServiceType, EmployeeTypeConfigPayload } from "@/lib/types/employee"
import { halalasToSarNumber } from "@/lib/money"
import {
  makeDefaultEmployeeTypeConfigs,
} from "../employee-service-option-overrides"
import {
  addServiceSchema,
  nextDraftKey,
  type AddServiceFormData,
} from "./draft-service.types"
import { AddServiceForm } from "./add-service-form"
import { ServiceSummaryCard } from "./service-summary-card"

export type { DraftService } from "./draft-service.types"

/* ─── Helper (module scope) ─── */

function convertSavedTypes(types: EmployeeServiceType[]): EmployeeTypeConfigPayload[] {
  return types.map((st) => ({
    deliveryType: st.deliveryType,
    price: st.price != null ? halalasToSarNumber(st.price) : undefined,
    duration: st.duration ?? undefined,
    useCustomOptions: st.useCustomOptions,
    isActive: st.isActive,
    durationOptions: st.durationOptions.map((o) => ({
      id: o.id,
      label: o.label,
      labelAr: o.labelAr ?? undefined,
      durationMinutes: o.durationMinutes,
      isDefault: o.isDefault,
      sortOrder: o.sortOrder,
      price: halalasToSarNumber(o.price),
    })),
  }))
}

/* ─── Props ─── */

interface ServicesTabProps {
  draftServices: import("./draft-service.types").DraftService[]
  onDraftServicesChange: (
    services: import("./draft-service.types").DraftService[],
  ) => void
  employeeId?: string
}

/* ─── Component ─── */

export function ServicesTab({
  draftServices,
  onDraftServicesChange,
  employeeId,
}: ServicesTabProps) {
  const { t, locale } = useLocale()
  const isAr = locale === "ar"
  const { services } = useServices()
  const [isAdding, setIsAdding] = useState(false)
  const [typeConfigs, setTypeConfigs] = useState<EmployeeTypeConfigPayload[]>([])
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const isEditingRef = useRef(false)

  // Derived from editingKey
  const editingDraft = editingKey ? draftServices.find((ds) => ds.key === editingKey) ?? null : null
  const editingServiceId = editingDraft?.serviceId ?? null

  /* Filter out already-added services (allow the editing one back in) */
  const availableServices = useMemo(
    () => {
      const addedServiceIds = new Set(draftServices.map((ds) => ds.serviceId))
      if (editingDraft) addedServiceIds.delete(editingDraft.serviceId)
      return (services ?? []).filter((s) => !addedServiceIds.has(s.id))
    },
    [services, draftServices, editingDraft],
  )

  const serviceLineage = (serviceId: string) => {
    const cat = services?.find((s) => s.id === serviceId)?.category
    const dep = cat?.department
    return {
      categoryName: cat ? (isAr ? cat.nameAr : cat.nameEn ?? cat.nameAr) : null,
      departmentName: dep ? (isAr ? dep.nameAr : dep.nameEn ?? dep.nameAr) : null,
    }
  }

  const availableServiceOptions = availableServices.map((s) => ({
    id: s.id,
    nameAr: s.nameAr,
    nameEn: s.nameEn ?? s.nameAr,
    ...serviceLineage(s.id),
  }))

  const form = useForm<AddServiceFormData>({
    resolver: zodResolver(addServiceSchema),
    defaultValues: { serviceId: "", bufferMinutes: 0, isActive: true },
  })

  const selectedServiceId = form.watch("serviceId")
  const { data: serviceBookingTypesData } = useServiceBookingTypes(
    selectedServiceId || null,
  )
  const serviceBookingTypes = useMemo(
    () => serviceBookingTypesData ?? [],
    [serviceBookingTypesData],
  )

  // Fetch saved per-practitioner types when editing
  const { data: savedEmployeeServiceTypes, isLoading: savedTypesLoading } =
    useEmployeeServiceTypes(employeeId ?? null, editingServiceId)

  // Reset typeConfigs to defaults when service changes (but not while editing)
  useEffect(() => {
    if (isEditingRef.current) return
    if (!selectedServiceId) {
      setTypeConfigs([])
      return
    }
    setTypeConfigs(makeDefaultEmployeeTypeConfigs(serviceBookingTypes))
  }, [selectedServiceId, serviceBookingTypes])

  // Prefill from saved types once the query resolves
  useEffect(() => {
    if (!editingKey || savedTypesLoading) return
    if (!savedEmployeeServiceTypes || savedEmployeeServiceTypes.length === 0) {
      setTypeConfigs(makeDefaultEmployeeTypeConfigs(serviceBookingTypes))
      return
    }
    setTypeConfigs(convertSavedTypes(savedEmployeeServiceTypes))
  }, [editingKey, savedEmployeeServiceTypes, savedTypesLoading, serviceBookingTypes])

  const handleEditService = (ds: import("./draft-service.types").DraftService) => {
    isEditingRef.current = true
    setEditingKey(ds.key)
    form.setValue("serviceId", ds.serviceId)
    form.setValue("bufferMinutes", ds.bufferMinutes)
    form.setValue("isActive", ds.isActive)
    setIsAdding(true)
  }

  const handleAddService = form.handleSubmit((data) => {
    const svc = services?.find((s) => s.id === data.serviceId)
    if (!svc) return

    const updatedDraft = {
      key: editingKey ?? nextDraftKey(),
      serviceId: data.serviceId,
      serviceName: isAr ? svc.nameAr : (svc.nameEn ?? svc.nameAr),
      bufferMinutes: data.bufferMinutes,
      isActive: data.isActive,
      availableTypes: typeConfigs.map((tc) => tc.deliveryType),
      types: typeConfigs,
      serviceBookingTypes,
    }

    if (editingKey) {
      onDraftServicesChange(draftServices.map((ds) => ds.key === editingKey ? updatedDraft : ds))
    } else {
      onDraftServicesChange([...draftServices, updatedDraft])
    }

    form.reset()
    setTypeConfigs([])
    setIsAdding(false)
    isEditingRef.current = false
    setEditingKey(null)
  })

  const removeService = (key: string) => {
    onDraftServicesChange(draftServices.filter((ds) => ds.key !== key))
  }

  const handleCancel = () => {
    setIsAdding(false)
    form.reset()
    setTypeConfigs([])
    isEditingRef.current = false
    setEditingKey(null)
  }

  return (
    <FormSection title={t("employees.create.tabs.services")} description={t("employees.create.servicesDescription")}>
      <div className="space-y-4">
        {draftServices.length === 0 && !isAdding && (
          <p className="text-sm text-muted-foreground">
            {t("employees.create.noServices")}
          </p>
        )}

        {draftServices.map((ds) =>
          editingKey === ds.key ? (
            <AddServiceForm
              key={ds.key}
              form={form}
              availableServices={availableServiceOptions}
              serviceBookingTypes={serviceBookingTypes}
              typeConfigs={typeConfigs}
              onTypeConfigsChange={setTypeConfigs}
              onSubmit={handleAddService}
              onCancel={handleCancel}
              t={t}
              locale={locale}
              isEditing
              editingServiceName={ds.serviceName}
            />
          ) : (
            <ServiceSummaryCard
              key={ds.key}
              draft={ds}
              departmentName={serviceLineage(ds.serviceId).departmentName}
              categoryName={serviceLineage(ds.serviceId).categoryName}
              onRemove={() => removeService(ds.key)}
              onEdit={() => handleEditService(ds)}
            />
          )
        )}

        {isAdding && !editingKey ? (
          <AddServiceForm
            form={form}
            availableServices={availableServiceOptions}
            serviceBookingTypes={serviceBookingTypes}
            typeConfigs={typeConfigs}
            onTypeConfigsChange={setTypeConfigs}
            onSubmit={handleAddService}
            onCancel={handleCancel}
            t={t}
            locale={locale}
            isEditing={false}
          />
        ) : !isAdding && !editingKey ? (
          <Button
            type="button"
            variant="outline"
            className="w-full gap-2"
            onClick={() => setIsAdding(true)}
          >
            <HugeiconsIcon icon={Add01Icon} size={16} />
            {t("employees.create.addService")}
          </Button>
        ) : null}
      </div>
    </FormSection>
  )
}
