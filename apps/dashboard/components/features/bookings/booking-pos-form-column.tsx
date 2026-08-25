"use client"

// Phase 6 — 2026-08-23 — extracted from `booking-pos.tsx` so the
// shell stays under the 350-line absolute limit. The shell owns
// state + mutation wiring; this component is pure JSX composition.
//
// W2B-T8 update — 2026-08-25 — added `onFlexibleCreditSelected` +
// `onClearFilter` plumbing and routed the PACKAGES track: when
// `state.creditFilter != null` render `<FlexibleCreditSections>`
// instead of `<PackagesCreditSections>` so the wizard offers only the
// options the spent FLEXIBLE credit permits, plus the restriction chip
// + clear button.

import { ClientStep } from "./booking-client-step"
import { ClientCreditsPanel } from "./client-credits-panel"
import type { BookingFormState, CreditTarget } from "./use-booking-form-state"
import type { CategoryBookingMode } from "./use-booking-form-state"

import {
  PackageSection,
  PackagesCreditSections,
  ProgramSection,
  TrackSection,
} from "./booking-pos-track-sections"
import { ClinicsSections } from "./booking-pos-clinics-sections"
import { FlexibleCreditSections } from "./booking-pos-flexible-sections"
import { CollapsibleSection, type SectionId } from "./pos-collapsible-section"

import type { BookingTrack } from "./use-booking-form-state"
import type { CreditFilter } from "@/lib/booking-credit-filter"

interface BookingPosFormColumnProps {
  state: BookingFormState
  openSection: SectionId
  setOpenSection: (id: SectionId) => void
  summaries: Record<SectionId, string | null>
  isServiceAutoSelected: boolean
  canShowTypeDuration: boolean
  canShowDatetime: boolean
  selectedDurationMins: number | null
  maxAdvanceDays: number
  creditBadgeReady: boolean
  useCredit: boolean
  creditDismissed: boolean
  branchId: string | null
  clientLabel: string
  onClientSelect: (id: string, name: string) => void
  onTrackSelect: (track: BookingTrack) => void
  onUseCredit: (target: CreditTarget) => void
  onPackageCreditSelected: (target: CreditTarget, packagePurchaseId: string) => void
  /**
   * W2B-T8 — the fixed prop name + signature the sibling task's
   * `StepPackage` expects on the receiving side.
   */
  onFlexibleCreditSelected: (filter: CreditFilter) => void
  /** W2B-T8 — clears the FLEXIBLE-credit restriction chip. */
  onClearFilter: () => void
  onProgramEnrolled: (programId: string, programName: string) => void
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

export function BookingPosFormColumn(p: BookingPosFormColumnProps) {
  const {
    state, openSection, setOpenSection, summaries, isServiceAutoSelected,
    canShowTypeDuration, canShowDatetime, selectedDurationMins, maxAdvanceDays,
    creditBadgeReady, useCredit, creditDismissed, branchId, clientLabel,
    onClientSelect, onTrackSelect, onUseCredit,
    onPackageCreditSelected, onFlexibleCreditSelected, onClearFilter,
    onProgramEnrolled, onDepartmentSelect,
    onCategorySelect, onServiceSelect, onEmployeeSelect, onSelectDeliveryType,
    onSelectDuration, onSelectDate, onSelectTime, onAcceptCredit, onDismissCredit,
  } = p
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-4">
      <CollapsibleSection
        id="client"
        label={clientLabel}
        summary={summaries.client}
        isOpen={openSection === "client"}
        isFilled={summaries.client !== null}
        onToggle={() => setOpenSection("client")}
      >
        <ClientStep onSelect={onClientSelect} />
      </CollapsibleSection>

      {state.clientId && (
        <ClientCreditsPanel clientId={state.clientId} onUseCredit={onUseCredit} />
      )}

      <TrackSection
        state={state}
        openSection={openSection}
        setOpenSection={setOpenSection}
        trackSummary={summaries.track}
        onSelect={onTrackSelect}
      />

      {state.track === "CLINICS" && (
        <ClinicsSections
          state={state}
          openSection={openSection}
          setOpenSection={setOpenSection}
          summaries={summaries}
          isServiceAutoSelected={isServiceAutoSelected}
          canShowTypeDuration={canShowTypeDuration}
          canShowDatetime={canShowDatetime}
          selectedDurationMins={selectedDurationMins}
          maxAdvanceDays={maxAdvanceDays}
          creditBadgeReady={creditBadgeReady}
          useCredit={useCredit}
          creditDismissed={creditDismissed}
          onDepartmentSelect={onDepartmentSelect}
          onCategorySelect={onCategorySelect}
          onServiceSelect={onServiceSelect}
          onEmployeeSelect={onEmployeeSelect}
          onSelectDeliveryType={onSelectDeliveryType}
          onSelectDuration={onSelectDuration}
          onSelectDate={onSelectDate}
          onSelectTime={onSelectTime}
          onAcceptCredit={onAcceptCredit}
          onDismissCredit={onDismissCredit}
        />
      )}

      {state.track === "PACKAGES" && (
        <>
          <PackageSection
            state={state}
            openSection={openSection}
            setOpenSection={setOpenSection}
            branchId={branchId}
            summary={summaries.package}
            onCreditSelected={onPackageCreditSelected}
            onFlexibleCreditSelected={onFlexibleCreditSelected}
          />
          {/* W2B-T8 — PACKAGES-track routing: when a FLEXIBLE credit is
              active, render the full department→datetime chain with the
              predicates threaded down (chip + clear button live inside
              `FlexibleCreditSections`). When the filter is null, fall
              back to the existing PINNED branch (`PackagesCreditSections`)
              which only renders typeDuration + datetime. */}
          {state.creditFilter ? (
            <FlexibleCreditSections
              state={state}
              openSection={openSection}
              setOpenSection={setOpenSection}
              summaries={summaries}
              isServiceAutoSelected={isServiceAutoSelected}
              canShowTypeDuration={canShowTypeDuration}
              canShowDatetime={canShowDatetime}
              selectedDurationMins={selectedDurationMins}
              maxAdvanceDays={maxAdvanceDays}
              creditFilter={state.creditFilter}
              onDepartmentSelect={onDepartmentSelect}
              onCategorySelect={onCategorySelect}
              onServiceSelect={onServiceSelect}
              onEmployeeSelect={onEmployeeSelect}
              onSelectDeliveryType={onSelectDeliveryType}
              onSelectDuration={onSelectDuration}
              onSelectDate={onSelectDate}
              onSelectTime={onSelectTime}
              onClearFilter={onClearFilter}
            />
          ) : (
            state.serviceId &&
            state.employeeId && (
              <PackagesCreditSections
                state={state}
                openSection={openSection}
                setOpenSection={setOpenSection}
                summaries={summaries}
                canShowTypeDuration={canShowTypeDuration}
                canShowDatetime={canShowDatetime}
                selectedDurationMins={selectedDurationMins}
                maxAdvanceDays={maxAdvanceDays}
                onSelectDeliveryType={onSelectDeliveryType}
                onSelectDuration={onSelectDuration}
                onSelectDate={onSelectDate}
                onSelectTime={onSelectTime}
              />
            )
          )}
        </>
      )}

      {state.track === "GROUP" && (
        <ProgramSection
          state={state}
          openSection={openSection}
          setOpenSection={setOpenSection}
          summary={summaries.program}
          onEnrolled={onProgramEnrolled}
        />
      )}
    </div>
  )
}