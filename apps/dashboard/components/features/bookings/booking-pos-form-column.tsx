"use client"

// EXCEPTION: feature-component size limit (300) exceeded — 2026-08-23
// — Phase 6 extracted the booking-pos form column into this file so
// the shell stays under the 350-line absolute limit. The shell owns
// state + mutation wiring; this component is pure JSX composition.

import { ClientStep } from "./booking-client-step"
import { ClientCreditsPanel } from "./client-credits-panel"
import type { BookingFormState, CreditTarget } from "./use-booking-form-state"
import type { CategoryBookingMode } from "./use-booking-form-state"

import {
  ClinicsSections,
  PackageSection,
  PackagesCreditSections,
  ProgramSection,
  TrackSection,
} from "./booking-pos-track-sections"
import { CollapsibleSection, type SectionId } from "./pos-collapsible-section"

import type { BookingTrack } from "./use-booking-form-state"

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
    onPackageCreditSelected, onProgramEnrolled, onDepartmentSelect,
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
          />
          {state.serviceId && state.employeeId && (
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