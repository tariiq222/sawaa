"use client"

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

/* ─── Props ─── */

interface BookingPosProps {
  onSuccess: () => void
  onCancel: () => void
}

/* ─── Section card ─── */

function PosSection({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      {children}
    </div>
  )
}

/* ─── Dependency hint ─── */

function PosSectionHint({ hint }: { hint: string }) {
  return (
    <p className="py-4 text-center text-sm text-muted-foreground">
      {hint}
    </p>
  )
}

/* ─── Main component ─── */

export function BookingPos({ onSuccess, onCancel }: BookingPosProps) {
  const { t } = useLocale()

  // Data hooks
  const { branches } = useBranches()
  const mainBranch = branches.find((b) => b.isMain) ?? branches[0]

  const { data: bookingSettings } = useBookingSettings()
  const maxAdvanceDays = bookingSettings?.maxAdvanceBookingDays ?? 90

  const { createMut } = useBookingMutations()

  // Form state
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

  // StepTypeDuration.onSelectType passes a plain string — cast to the hook's narrow type
  const handleSelectType = (type: string) => {
    selectType(type as "in_person" | "online" | "walk_in")
  }

  // Visibility guards
  const canShowTypeDuration = Boolean(state.serviceId && state.employeeId)
  const canShowDatetime = Boolean(state.serviceId && state.employeeId && state.type)

  // Submit
  const handleSubmit = async () => {
    if (
      !state.clientId ||
      !state.serviceId ||
      !state.employeeId ||
      !state.type ||
      !state.date ||
      !state.startTime
    )
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
        <h1 className="text-base font-semibold text-foreground">
          {t("bookings.newBooking")}
        </h1>
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
          <PosSection label={t("bookings.pos.section.client")}>
            <ClientStep onSelect={selectClient} />
          </PosSection>

          {/* 2. Service */}
          <PosSection label={t("bookings.pos.section.service")}>
            <StepService onSelect={selectService} />
          </PosSection>

          {/* 3. Employee */}
          <PosSection label={t("bookings.pos.section.employee")}>
            <StepEmployee
              serviceId={state.serviceId ?? ""}
              onSelect={selectEmployee}
            />
          </PosSection>

          {/* 4. Type & Duration */}
          <PosSection label={t("bookings.pos.section.typeDuration")}>
            {canShowTypeDuration ? (
              <StepTypeDuration
                employeeId={state.employeeId!}
                serviceId={state.serviceId!}
                selectedType={state.type}
                selectedDurationOptionId={state.durationOptionId}
                onSelectType={handleSelectType}
                onSelectDuration={selectDuration}
                onSkipDuration={skipDuration}
              />
            ) : (
              <PosSectionHint hint={t("bookings.pos.hint.needService")} />
            )}
          </PosSection>

          {/* 5. Date & Time */}
          <PosSection label={t("bookings.pos.section.datetime")}>
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
          </PosSection>
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
