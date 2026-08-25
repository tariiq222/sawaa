"use client"

// Phase 6 split the booking-pos wizard into a shell + per-track
// section groups. This file owns pure JSX composition for the
// generic track / package / program sections and the PACKAGES-track
// `PackagesCreditSections` pair; state and handleSubmit continue to
// live in `booking-pos.tsx`. The CLINICS-track chain (department →
// category → service → employee → typeDuration → datetime, plus the
// `MatchingCreditBadge`) now lives in `booking-pos-clinics-sections.tsx`.
//
// W2B-T8 update — 2026-08-25 — `PackageSection` now also forwards
// the optional `onFlexibleCreditSelected` prop to `StepPackage` so
// the sibling-owned FLEXIBLE-credit picker can emit a `CreditFilter`
// straight back to the shell. The clear-restriction chip + button
// live in `booking-pos-flexible-sections.tsx`.
//
// W2B-T12 — extracted `ClinicsSections` into
// `booking-pos-clinics-sections.tsx` on 2026-08-25 to bring this file
// back under the 350-line absolute limit; appending a second
// `// EXCEPTION:` block was rejected by review as unacceptable
// practice. Behaviour, prop contracts, and the pre-existing
// `state.employeeId!` / `state.serviceId!` non-null assertions are
// unchanged — this is a pure move.

import { CollapsibleSection, PosSectionHint, type SectionId } from "./pos-collapsible-section"
import { StepTypeDuration } from "./wizard-steps/step-type-duration"
import { StepDatetime } from "./wizard-steps/step-datetime"
import { StepTrack } from "./wizard-steps/step-track"
import { StepPackage } from "./wizard-steps/step-package"
import { StepProgram } from "./wizard-steps/step-program"

import { useLocale } from "@/components/locale-provider"

import type { CreditFilter } from "@/lib/booking-credit-filter"

import type {
  BookingFormState,
  BookingTrack,
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
  /**
   * W2B-T8 — forwarded to `StepPackage`'s fixed
   * `onFlexibleCreditSelected?: (filter: CreditFilter) => void` prop.
   * The sibling step-package task owns the receiver; this file only
   * passes it through. Optional so surfaces that do not yet support
   * the FLEXIBLE-credit branch keep compiling.
   */
  onFlexibleCreditSelected?: (filter: CreditFilter) => void
}

export function PackageSection({
  state, openSection, setOpenSection, branchId, summary,
  onCreditSelected, onFlexibleCreditSelected,
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
          onFlexibleCreditSelected={onFlexibleCreditSelected}
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