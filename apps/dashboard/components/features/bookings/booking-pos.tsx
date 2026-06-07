"use client"

import { useState, useMemo } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Cancel01Icon } from "@hugeicons/core-free-icons"
import { toast } from "sonner"
import { useQuery } from "@tanstack/react-query"

import { useLocale } from "@/components/locale-provider"
import { useBranches } from "@/hooks/use-branches"
import { useBookingSettings } from "@/hooks/use-organization-settings"
import { useBookingMutations } from "@/hooks/use-bookings"
import { queryKeys } from "@/lib/query-keys"
import { fetchServices } from "@/lib/api/services"
import { ApiError } from "@/lib/api"
import { bookingPosPayloadSchema } from "@/lib/schemas/booking.schema"

import { ClientStep } from "./booking-client-step"
import { StepDepartment } from "./wizard-steps/step-department"
import { StepCategory } from "./wizard-steps/step-category"
import { StepService } from "./wizard-steps/step-service"
import { StepEmployee } from "./wizard-steps/step-employee"
import { StepTypeDuration } from "./wizard-steps/step-type-duration"
import { StepDatetime } from "./wizard-steps/step-datetime"
import { BookingSummary } from "./booking-summary"
import { useBookingFormState } from "./use-booking-form-state"
import { CollapsibleSection, PosSectionHint, type SectionId } from "./pos-collapsible-section"

/* ─── Props ─── */

interface BookingPosProps {
  onSuccess: () => void
  onCancel: () => void
}

/* ─── Main component ─── */

export function BookingPos({ onSuccess, onCancel }: BookingPosProps) {
  const { t } = useLocale()
  const [openSection, setOpenSection] = useState<SectionId>("client")

  const { branches } = useBranches()
  const mainBranch = branches.find((b) => b.isMain) ?? branches[0]
  const { data: bookingSettings } = useBookingSettings()
  const maxAdvanceDays = bookingSettings?.maxAdvanceBookingDays ?? 90
  const { createMut } = useBookingMutations()

  const {
    state,
    isComplete,
    reset,
    selectClient,
    selectDepartment,
    selectCategory,
    selectService,
    selectEmployee,
    selectDeliveryType,
    selectDuration,
    skipDuration,
    selectDate,
    selectTime,
    setPayAtClinic,
    setCouponCode,
  } = useBookingFormState()

  const handleSelectDeliveryType = (deliveryType: string) => {
    selectDeliveryType(deliveryType as "in_person" | "online")
  }

  // Auto-advance wrapped handlers
  const handleClientSelect = (id: string, name: string) => { selectClient(id, name); setOpenSection("department") }
  const handleDepartmentSelect = (id: string, name: string) => { selectDepartment(id, name); setOpenSection("category") }
  const handleCategorySelect = (id: string, name: string) => { selectCategory(id, name); setOpenSection("service") }
  const handleServiceSelect = (id: string, name: string) => { selectService(id, name); setOpenSection("employee") }
  const handleEmployeeSelect = (id: string, name: string) => { selectEmployee(id, name); setOpenSection("typeDuration") }
  const handleDurationSelect = (optId: string, label: string) => { selectDuration(optId, label); setOpenSection("datetime") }
  const handleSkipDuration = () => { skipDuration(); setOpenSection("datetime") }

  // Summary strings for collapsed chips
  const deliveryTypeLabels: Record<string, string> = {
    in_person: t("bookings.wizard.step.typeDuration.inPerson"),
    online: t("bookings.wizard.step.typeDuration.online"),
  }
  const summaries: Record<SectionId, string | null> = {
    client: state.clientName,
    department: state.departmentName,
    category: state.categoryName,
    service: state.serviceName,
    employee: state.employeeName,
    typeDuration: state.deliveryType
      ? [deliveryTypeLabels[state.deliveryType], state.durationLabel].filter(Boolean).join(" · ")
      : null,
    datetime: state.date
      ? state.date + (state.startTime ? ` · ${state.startTime}` : "")
      : null,
  }

  const canShowTypeDuration = Boolean(state.serviceId && state.employeeId)
  const canShowDatetime = Boolean(state.serviceId && state.employeeId && state.deliveryType)

  // Selected service price (halalas) for the summary. Reuses the same query
  // StepService issues (same filters → same cache key), so TanStack Query
  // serves it from cache — no extra fetch.
  const serviceFilters = { isActive: true, perPage: 100, categoryId: state.categoryId ?? "" }
  const { data: servicesData } = useQuery({
    queryKey: queryKeys.services.list(serviceFilters),
    queryFn: () => fetchServices(serviceFilters),
    enabled: !!state.categoryId,
    staleTime: 5 * 60 * 1000,
  })
  const servicePriceHalalas = useMemo(() => {
    if (!state.serviceId) return null
    const svc = servicesData?.items.find((s) => s.id === state.serviceId)
    return svc ? Number(svc.price) : null
  }, [servicesData, state.serviceId])

  const handleSubmit = async () => {
    if (!state.clientId || !state.serviceId || !state.employeeId || !state.deliveryType || !state.date || !state.startTime)
      return
    const payload = {
      clientId: state.clientId,
      employeeId: state.employeeId,
      serviceId: state.serviceId,
      type: "individual" as const,
      deliveryType: state.deliveryType.toLowerCase() as "in_person" | "online",
      durationOptionId: state.durationOptionId ?? undefined,
      date: state.date,
      startTime: state.startTime,
      payAtClinic: state.payAtClinic,
      branchId: mainBranch?.id,
      couponCode: state.couponCode ?? undefined,
    }
    const validation = bookingPosPayloadSchema.safeParse(payload)
    if (!validation.success) {
      toast.error(t("bookings.wizard.submitError"))
      return
    }
    try {
      await createMut.mutateAsync(validation.data)
      reset()
      onSuccess()
    } catch (err) {
      if (err instanceof ApiError && err.status >= 500) {
        const requestId = (err.body as Record<string, unknown> | undefined)?.requestId as string | undefined
        const base = t("bookings.wizard.submitError")
        toast.error(requestId ? `${base} (رقم الطلب: ${requestId})` : base)
      } else {
        toast.error(err instanceof Error ? err.message : t("bookings.wizard.submitError"))
      }
    }
  }

  return (
    <div className="flex flex-col gap-4 p-4 md:p-5">
      {/* ── Top bar ── */}
      <div className="flex items-center justify-between">
        <h1 className="text-base font-semibold text-foreground">{t("bookings.newBooking")}</h1>
        <button
          type="button"
          aria-label={t("common.close")}
          className="rounded-lg p-2.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          onClick={onCancel}
        >
          <HugeiconsIcon icon={Cancel01Icon} size={16} />
        </button>
      </div>

      {/* ── Two-column POS layout ── */}
        <div className="flex flex-col gap-6 md:flex-row">
          {/* Form column */}
          <div className="flex min-w-0 flex-1 flex-col gap-4">
          {/* 1. Client */}
          <CollapsibleSection
            id="client"
            label={t("bookings.pos.section.client")}
            summary={summaries.client}
            isOpen={openSection === "client"}
            isFilled={summaries.client !== null}
            onToggle={() => setOpenSection("client")}
          >
            <ClientStep onSelect={handleClientSelect} />
          </CollapsibleSection>

          {/* 2. Department */}
          <CollapsibleSection
            id="department"
            label={t("bookings.pos.section.department")}
            summary={summaries.department}
            isOpen={openSection === "department"}
            isFilled={summaries.department !== null}
            onToggle={() => setOpenSection("department")}
          >
            <StepDepartment onSelect={handleDepartmentSelect} />
          </CollapsibleSection>

          {/* 3. Category (clinic) */}
          <CollapsibleSection
            id="category"
            label={t("bookings.pos.section.category")}
            summary={summaries.category}
            isOpen={openSection === "category"}
            isFilled={summaries.category !== null}
            onToggle={() => setOpenSection("category")}
          >
            {state.departmentId ? (
              <StepCategory departmentId={state.departmentId} onSelect={handleCategorySelect} />
            ) : (
              <PosSectionHint hint={t("bookings.pos.hint.needDepartment")} />
            )}
          </CollapsibleSection>

          {/* 4. Service */}
          <CollapsibleSection
            id="service"
            label={t("bookings.pos.section.service")}
            summary={summaries.service}
            isOpen={openSection === "service"}
            isFilled={summaries.service !== null}
            onToggle={() => setOpenSection("service")}
          >
            {state.categoryId ? (
              <StepService categoryId={state.categoryId} onSelect={handleServiceSelect} />
            ) : (
              <PosSectionHint hint={t("bookings.pos.hint.needCategory")} />
            )}
          </CollapsibleSection>

          {/* 5. Employee */}
          <CollapsibleSection
            id="employee"
            label={t("bookings.pos.section.employee")}
            summary={summaries.employee}
            isOpen={openSection === "employee"}
            isFilled={summaries.employee !== null}
            onToggle={() => setOpenSection("employee")}
          >
            <StepEmployee serviceId={state.serviceId ?? ""} onSelect={handleEmployeeSelect} />
          </CollapsibleSection>

          {/* 4. Type & Duration */}
          <CollapsibleSection
            id="typeDuration"
            label={t("bookings.pos.section.typeDuration")}
            summary={summaries.typeDuration}
            isOpen={openSection === "typeDuration"}
            isFilled={summaries.typeDuration !== null}
            onToggle={() => setOpenSection("typeDuration")}
          >
            {canShowTypeDuration ? (
              <StepTypeDuration
                employeeId={state.employeeId!}
                serviceId={state.serviceId!}
                selectedType={state.deliveryType}
                selectedDurationOptionId={state.durationOptionId}
                onSelectType={handleSelectDeliveryType}
                onSelectDuration={handleDurationSelect}
                onSkipDuration={handleSkipDuration}
              />
            ) : (
              <PosSectionHint hint={t("bookings.pos.hint.needService")} />
            )}
          </CollapsibleSection>

          {/* 5. Date & Time */}
          <CollapsibleSection
            id="datetime"
            label={t("bookings.pos.section.datetime")}
            summary={summaries.datetime}
            isOpen={openSection === "datetime"}
            isFilled={summaries.datetime !== null}
            onToggle={() => setOpenSection("datetime")}
          >
            {canShowDatetime ? (
              <StepDatetime
                employeeId={state.employeeId!}
                serviceId={state.serviceId!}
                deliveryType={state.deliveryType!}
                durationOptionId={state.durationOptionId}
                selectedDate={state.date}
                selectedTime={state.startTime}
                onSelectDate={selectDate}
                onSelectTime={selectTime}
                maxAdvanceDays={maxAdvanceDays}
              />
            ) : (
              <PosSectionHint hint={t("bookings.pos.hint.needEmployee")} />
            )}
          </CollapsibleSection>
        </div>

        {/* Summary column */}
        <div className="w-full shrink-0 md:w-80">
          <BookingSummary
            clientName={state.clientName}
            serviceName={state.serviceName}
            employeeName={state.employeeName}
            type={state.deliveryType}
            durationLabel={state.durationLabel}
            date={state.date}
            startTime={state.startTime}
            servicePriceHalalas={servicePriceHalalas}
            payAtClinic={state.payAtClinic}
            couponCode={state.couponCode}
            submitting={createMut.isPending}
            isComplete={isComplete}
            onTogglePayAtClinic={setPayAtClinic}
            onCouponChange={setCouponCode}
            onSubmit={handleSubmit}
          />
        </div>
      </div>
    </div>
  )
}
