"use client"

// EXCEPTION: absolute file size limit (350) reached — 2026-08-23 —
// Phase 6 split the booking-pos wizard into a shell + per-track
// section groups. This file owns pure JSX composition; state and
// handleSubmit continue to live in `booking-pos.tsx`.

import { CollapsibleSection, PosSectionHint, type SectionId } from "./pos-collapsible-section"
import { StepDepartment } from "./wizard-steps/step-department"
import { StepCategory } from "./wizard-steps/step-category"
import { StepService } from "./wizard-steps/step-service"
import { StepEmployee } from "./wizard-steps/step-employee"
import { StepTypeDuration } from "./wizard-steps/step-type-duration"
import { StepDatetime } from "./wizard-steps/step-datetime"
import { StepTrack } from "./wizard-steps/step-track"
import { StepPackage } from "./wizard-steps/step-package"
import { StepProgram } from "./wizard-steps/step-program"
import { MatchingCreditBadge } from "./matching-credit-badge"

import { useLocale } from "@/components/locale-provider"

import type {
  BookingFormState,
  BookingTrack,
  CategoryBookingMode,
  CreditTarget,
} from "./use-booking-form-state"

interface OpenSectionController {
  openSection: SectionId
  setOpenSection: (id: SectionId) => void
}

interface TrackSectionProps extends OpenSectionController {
  state: BookingFormState
  trackSummary: string | null
  onSelect: (track: BookingTrack) => void
}

export function TrackSection({
  state, openSection, setOpenSection, trackSummary, onSelect,
}: TrackSectionProps) {
  const { t } = useLocale()
  return (
    <CollapsibleSection
      id="track"
      label={t("bookings.pos.section.track")}
      summary={trackSummary}
      isOpen={openSection === "track"}
      isFilled={trackSummary !== null}
      onToggle={() => setOpenSection("track")}
    >
      <StepTrack selected={state.track} onSelect={onSelect} />
    </CollapsibleSection>
  )
}

interface PackageSectionProps extends OpenSectionController {
  state: BookingFormState
  branchId: string | null
  summary: string | null
  onCreditSelected: (target: CreditTarget, packagePurchaseId: string) => void
}

export function PackageSection({
  state, openSection, setOpenSection, branchId, summary, onCreditSelected,
}: PackageSectionProps) {
  const { t } = useLocale()
  return (
    <CollapsibleSection
      id="package"
      label={t("bookings.pos.section.package")}
      summary={summary}
      isOpen={openSection === "package"}
      isFilled={summary !== null}
      onToggle={() => setOpenSection("package")}
    >
      {state.clientId && branchId ? (
        <StepPackage
          clientId={state.clientId}
          branchId={branchId}
          onCreditSelected={onCreditSelected}
        />
      ) : (
        <PosSectionHint hint={t("bookings.pos.hint.needClient")} />
      )}
    </CollapsibleSection>
  )
}

interface ProgramSectionProps extends OpenSectionController {
  state: BookingFormState
  summary: string | null
  onEnrolled: (programId: string, programName: string) => void
}

export function ProgramSection({
  state, openSection, setOpenSection, summary, onEnrolled,
}: ProgramSectionProps) {
  const { t } = useLocale()
  return (
    <CollapsibleSection
      id="program"
      label={t("bookings.pos.section.program")}
      summary={summary}
      isOpen={openSection === "program"}
      isFilled={summary !== null}
      onToggle={() => setOpenSection("program")}
    >
      {state.clientId ? (
        <StepProgram
          clientId={state.clientId}
          selectedProgramId={state.programId}
          onEnrolled={onEnrolled}
        />
      ) : (
        <PosSectionHint hint={t("bookings.pos.hint.needClient")} />
      )}
    </CollapsibleSection>
  )
}

interface ClinicsSectionsProps extends OpenSectionController {
  state: BookingFormState
  summaries: Record<SectionId, string | null>
  isServiceAutoSelected: boolean
  canShowTypeDuration: boolean
  canShowDatetime: boolean
  selectedDurationMins: number | null
  maxAdvanceDays: number
  creditBadgeReady: boolean
  useCredit: boolean
  creditDismissed: boolean
  onDepartmentSelect: (id: string, name: string) => void
  onCategorySelect: (id: string, name: string, bookingMode: CategoryBookingMode | null) => Promise<void>
  onServiceSelect: (id: string, name: string) => void
  onEmployeeSelect: (id: string, name: string) => void
  onSelectDeliveryType: (deliveryType: string, durationOptionId: string | null) => void
  onSelectDuration: (durationOptionId: string) => void
  onSelectDate: (date: string) => void
  onSelectTime: (startTime: string) => void
  onAcceptCredit: () => void
  onDismissCredit: () => void
}

export function ClinicsSections(p: ClinicsSectionsProps) {
  const { t } = useLocale()
  const { state, openSection, setOpenSection, summaries, isServiceAutoSelected, canShowTypeDuration, canShowDatetime, selectedDurationMins, maxAdvanceDays, creditBadgeReady, useCredit, creditDismissed, onDepartmentSelect, onCategorySelect, onServiceSelect, onEmployeeSelect, onSelectDeliveryType, onSelectDuration, onSelectDate, onSelectTime, onAcceptCredit, onDismissCredit } = p
  return (
    <>
      <CollapsibleSection
        id="department"
        label={t("bookings.pos.section.department")}
        summary={summaries.department}
        isOpen={openSection === "department"}
        isFilled={summaries.department !== null}
        onToggle={() => setOpenSection("department")}
      >
        <StepDepartment onSelect={onDepartmentSelect} />
      </CollapsibleSection>

      <CollapsibleSection
        id="category"
        label={t("bookings.pos.section.category")}
        summary={summaries.category}
        isOpen={openSection === "category"}
        isFilled={summaries.category !== null}
        onToggle={() => setOpenSection("category")}
      >
        {state.departmentId ? (
          <StepCategory departmentId={state.departmentId} onSelect={onCategorySelect} />
        ) : (
          <PosSectionHint hint={t("bookings.pos.hint.needDepartment")} />
        )}
      </CollapsibleSection>

      {!isServiceAutoSelected && (
        <CollapsibleSection
          id="service"
          label={t("bookings.pos.section.service")}
          summary={summaries.service}
          isOpen={openSection === "service"}
          isFilled={summaries.service !== null}
          onToggle={() => setOpenSection("service")}
        >
          {state.categoryId ? (
            <StepService categoryId={state.categoryId} onSelect={onServiceSelect} />
          ) : (
            <PosSectionHint hint={t("bookings.pos.hint.needCategory")} />
          )}
        </CollapsibleSection>
      )}

      <CollapsibleSection
        id="employee"
        label={t("bookings.pos.section.employee")}
        summary={summaries.employee}
        isOpen={openSection === "employee"}
        isFilled={summaries.employee !== null}
        onToggle={() => setOpenSection("employee")}
      >
        <StepEmployee serviceId={state.serviceId ?? ""} onSelect={onEmployeeSelect} />
      </CollapsibleSection>

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
            onSelectType={onSelectDeliveryType}
            selectedDurationOptionId={state.durationOptionId}
            onSelectDuration={onSelectDuration}
          />
        ) : (
          <PosSectionHint hint={t("bookings.pos.hint.needService")} />
        )}
      </CollapsibleSection>

      <CollapsibleSection
        id="datetime"
        label={t("bookings.pos.section.datetime")}
        summary={summaries.datetime}
        isOpen={openSection === "datetime"}
        isFilled={summaries.datetime !== null}
        onToggle={() => setOpenSection("datetime")}
      >
        {canShowDatetime ? (
          <>
            <StepDatetime
              employeeId={state.employeeId!}
              serviceId={state.serviceId!}
              deliveryType={state.deliveryType!}
              durationOptionId={state.durationOptionId}
              durationMins={selectedDurationMins}
              selectedDate={state.date}
              selectedTime={state.startTime}
              onSelectDate={onSelectDate}
              onSelectTime={onSelectTime}
              maxAdvanceDays={maxAdvanceDays}
            />
            {/* Phase 3 — auto-detect "احجز من الرصيد" badge once all four
                params are set. Renders nothing until then. */}
            {creditBadgeReady && (
              <div className="mt-3">
                <MatchingCreditBadge
                  clientId={state.clientId}
                  serviceId={state.serviceId}
                  employeeId={state.employeeId}
                  durationOptionId={state.durationOptionId}
                  useCredit={useCredit}
                  dismissed={creditDismissed}
                  onAccept={onAcceptCredit}
                  onDismiss={onDismissCredit}
                />
              </div>
            )}
          </>
        ) : (
          <PosSectionHint hint={t("bookings.pos.hint.needEmployee")} />
        )}
      </CollapsibleSection>
    </>
  )
}

interface PackagesCreditSectionsProps extends OpenSectionController {
  state: BookingFormState
  summaries: Record<SectionId, string | null>
  canShowTypeDuration: boolean
  canShowDatetime: boolean
  selectedDurationMins: number | null
  maxAdvanceDays: number
  onSelectDeliveryType: (deliveryType: string, durationOptionId: string | null) => void
  onSelectDuration: (durationOptionId: string) => void
  onSelectDate: (date: string) => void
  onSelectTime: (startTime: string) => void
}

/** PACKAGES-track typeDuration + datetime pair rendered after the
 *  operator picks a credit. Same components as CLINICS but no
 *  department/category/service/employee sections and no credit badge. */
export function PackagesCreditSections(p: PackagesCreditSectionsProps) {
  const { t } = useLocale()
  const { state, openSection, setOpenSection, summaries, canShowTypeDuration, canShowDatetime, selectedDurationMins, maxAdvanceDays, onSelectDeliveryType, onSelectDuration, onSelectDate, onSelectTime } = p
  return (
    <>
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
            onSelectType={onSelectDeliveryType}
            selectedDurationOptionId={state.durationOptionId}
            onSelectDuration={onSelectDuration}
          />
        ) : (
          <PosSectionHint hint={t("bookings.pos.hint.needService")} />
        )}
      </CollapsibleSection>

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
            durationMins={selectedDurationMins}
            selectedDate={state.date}
            selectedTime={state.startTime}
            onSelectDate={onSelectDate}
            onSelectTime={onSelectTime}
            maxAdvanceDays={maxAdvanceDays}
          />
        ) : (
          <PosSectionHint hint={t("bookings.pos.hint.needEmployee")} />
        )}
      </CollapsibleSection>
    </>
  )
}