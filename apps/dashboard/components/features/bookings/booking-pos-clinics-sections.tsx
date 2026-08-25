"use client"

// W2B-T12 — CLINICS-track section chain extracted from
// `booking-pos-track-sections.tsx` on 2026-08-25 to restore the
// repository's 350-line absolute file limit. The origin file was
// sitting AT the cap with a single `// EXCEPTION:` block, and the
// W2B-T8 wave pushed it to 362 lines; appending a second
// `// EXCEPTION:` header was rejected by review as unacceptable
// practice. Instead, the CLINICS-only composition was split into
// this sibling file, modeled on the structure of
// `booking-pos-flexible-sections.tsx` (the PACKAGES FLEXIBLE-credit
// sections that the previous wave split off the same way).
//
// Behaviour, prop contracts, render output, section ordering, and
// the pre-existing `state.employeeId!` / `state.serviceId!`
// non-null assertions carry across unchanged. This is a pure move,
// not a rewrite. `OpenSectionController` is duplicated locally here
// to match the pattern used by `booking-pos-flexible-sections.tsx`
// and to keep the new file self-contained.

import { CollapsibleSection, PosSectionHint, type SectionId } from "./pos-collapsible-section"
import { StepDepartment } from "./wizard-steps/step-department"
import { StepCategory } from "./wizard-steps/step-category"
import { StepService } from "./wizard-steps/step-service"
import { StepEmployee } from "./wizard-steps/step-employee"
import { StepTypeDuration } from "./wizard-steps/step-type-duration"
import { StepDatetime } from "./wizard-steps/step-datetime"
import { MatchingCreditBadge } from "./matching-credit-badge"

import { useLocale } from "@/components/locale-provider"

import type {
  BookingFormState,
  CategoryBookingMode,
} from "./use-booking-form-state"

interface OpenSectionController {
  openSection: SectionId
  setOpenSection: (id: SectionId) => void
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
