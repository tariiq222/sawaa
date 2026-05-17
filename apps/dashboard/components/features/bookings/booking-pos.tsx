"use client"

import { useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Cancel01Icon } from "@hugeicons/core-free-icons"
import { toast } from "sonner"

import { useLocale } from "@/components/locale-provider"
import { useBranches } from "@/hooks/use-branches"
import { useBookingSettings } from "@/hooks/use-organization-settings"
import { useBookingMutations } from "@/hooks/use-bookings"

import { ClientStep } from "./booking-client-step"
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
    selectService,
    selectEmployee,
    selectType,
    selectDuration,
    skipDuration,
    selectDate,
    selectTime,
    setPayAtClinic,
    setCouponCode,
  } = useBookingFormState()

  const handleSelectType = (type: string) => {
    selectType(type as "in_person" | "online" | "walk_in")
  }

  // Auto-advance wrapped handlers
  const handleClientSelect = (id: string, name: string) => { selectClient(id, name); setOpenSection("service") }
  const handleServiceSelect = (id: string, name: string) => { selectService(id, name); setOpenSection("employee") }
  const handleEmployeeSelect = (id: string, name: string) => { selectEmployee(id, name); setOpenSection("typeDuration") }
  const handleDurationSelect = (optId: string, label: string) => { selectDuration(optId, label); setOpenSection("datetime") }
  const handleSkipDuration = () => { skipDuration(); setOpenSection("datetime") }

  // Summary strings for collapsed chips
  const typeLabels: Record<string, string> = {
    in_person: t("bookings.wizard.step.typeDuration.inPerson"),
    online: t("bookings.wizard.step.typeDuration.online"),
    walk_in: t("bookings.wizard.step.typeDuration.walkIn"),
  }
  const summaries: Record<SectionId, string | null> = {
    client: state.clientName,
    service: state.serviceName,
    employee: state.employeeName,
    typeDuration: state.type
      ? [typeLabels[state.type], state.durationLabel].filter(Boolean).join(" · ")
      : null,
    datetime: state.date
      ? state.date + (state.startTime ? ` · ${state.startTime}` : "")
      : null,
  }

  const canShowTypeDuration = Boolean(state.serviceId && state.employeeId)
  const canShowDatetime = Boolean(state.serviceId && state.employeeId && state.type)

  const handleSubmit = async () => {
    if (!state.clientId || !state.serviceId || !state.employeeId || !state.type || !state.date || !state.startTime)
      return
    try {
      await createMut.mutateAsync({
        clientId: state.clientId,
        employeeId: state.employeeId,
        serviceId: state.serviceId,
        type: state.type,
        durationOptionId: state.durationOptionId ?? undefined,
        date: state.date,
        startTime: state.startTime,
        payAtClinic: state.payAtClinic,
        branchId: mainBranch?.id,
        couponCode: state.couponCode ?? undefined,
      })
      reset()
      onSuccess()
    } catch {
      toast.error(t("bookings.wizard.submitError"))
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ── Top bar ── */}
      <div className="flex items-center justify-between">
        <h1 className="text-base font-semibold text-foreground">{t("bookings.newBooking")}</h1>
        <button
          type="button"
          aria-label={t("common.close")}
          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          onClick={onCancel}
        >
          <HugeiconsIcon icon={Cancel01Icon} size={16} />
        </button>
      </div>

      {/* ── Two-column POS layout ── */}
      <div className="flex flex-col gap-6 md:flex-row">
        {/* Form column */}
        <div className="flex flex-1 flex-col gap-4">
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

          {/* 2. Service */}
          <CollapsibleSection
            id="service"
            label={t("bookings.pos.section.service")}
            summary={summaries.service}
            isOpen={openSection === "service"}
            isFilled={summaries.service !== null}
            onToggle={() => setOpenSection("service")}
          >
            <StepService onSelect={handleServiceSelect} />
          </CollapsibleSection>

          {/* 3. Employee */}
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
                selectedType={state.type}
                selectedDurationOptionId={state.durationOptionId}
                onSelectType={handleSelectType}
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
                bookingType={state.type!}
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
            type={state.type}
            durationLabel={state.durationLabel}
            date={state.date}
            startTime={state.startTime}
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
