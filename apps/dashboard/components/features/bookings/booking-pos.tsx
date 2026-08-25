"use client"

// W4-T13 split — 2026-08-25 — extracted the ~180-line handler
// block into `useBookingPosTrackHandlers` +
// `useBookingPosSelectionHandlers` (further split along a
// track/credit/program vs. selection-chain seam so each hook
// stays under the 200-line limit) and the ~80-line derived
// block into `useBookingPosDerived`. The shell now owns state
// setup, mutation wiring, the `BookingSummary` composition, and
// the JSX tree. The file is back under the 300-line feature
// cap without needing a size EXCEPTION.
//
// Phase 6 — 2026-08-23 — the three-track booking wizard
// (CLINICS / GROUP / PACKAGES). The per-track section groups
// live in `booking-pos-track-sections.tsx`, the form column in
// `booking-pos-form-column.tsx`, and `handleSubmit` in
// `useBookingPosSubmit`. The shell still owns state, mutation
// wiring, and the BookingSummary.
//
// W2-T2 update — 2026-08-23 — wires `usePaymentSettings` to gate
// the "الدفع في العيادة" option, exposes the `hideCollectionTiming`
// flag on the credit/package path, and forwards `collectionMethod` +
// `setCollectionMethod` into `BookingSummary`.
//
// W2B-T8 update — 2026-08-25 — wires the FLEXIBLE-credit flow:
// `applyCreditFilter` / `clearCreditFilter` are pulled from
// `useBookingFormState`, two new handlers route the operator between
// the FLEXIBLE and PINNED package branches, and the form column is
// given `onFlexibleCreditSelected` + `onClearFilter` so the chip's
// clear button can drive `setOpenSection("package")` after a clear.
// `hideCollectionTiming` is UNCHANGED — `applyCreditFilter` sets
// `packagePurchaseId` which already keeps the flag true.
//
// W3-T11 update — 2026-08-25 — closes two FLEXIBLE-credit guard
// gaps. (1) DIRECT-category auto-select is now wrapped in an
// `isServiceAllowed(creditFilter, hiddenId)` check so a forbidden
// hidden service is never auto-picked; the operator sees a toast
// reusing the existing `filter.noOptions` key and stays on the
// category step. (2) `canShowDatetime` now also requires
// `durationOptionId != null` when `creditFilter != null`, so an
// all-durations-disallowed credit makes the datetime step unopenable
// and `isComplete` can never become true. `hideCollectionTiming` is
// UNCHANGED.

import { useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Cancel01Icon } from "@hugeicons/core-free-icons"
import { useQueryClient } from "@tanstack/react-query"

import { useLocale } from "@/components/locale-provider"
import { useBranches } from "@/hooks/use-branches"
import { useBookingSettings, usePaymentSettings } from "@/hooks/use-organization-settings"

import { BookingSummary } from "./booking-summary"
import { BookingPosFormColumn } from "./booking-pos-form-column"
import type { SectionId } from "./pos-collapsible-section"
import { useBookingFormState } from "./use-booking-form-state"
import { useBookingPosSubmit } from "./use-booking-pos-submit"
import { useBookingPosTrackHandlers } from "./use-booking-pos-track-handlers"
import { useBookingPosSelectionHandlers } from "./use-booking-pos-selection-handlers"
import { useBookingPosDerived } from "./use-booking-pos-derived"

/* ─── Pure helpers ─── */

/**
 * When the operator switches delivery type, preserve an already-set
 * durationOptionId if it still exists among the new serviceType's options.
 * Falls back to `defaultId` (the type's default/first option) otherwise.
 */
export function resolvePreservedDurationOptionId(
  currentId: string | null,
  serviceType: import("@/lib/types/employee").EmployeeServiceType | undefined,
  defaultId: string | null,
): string | null {
  if (!currentId) return defaultId
  const options = serviceType?.durationOptions ?? []
  const stillPresent = options.some((o) => o.id === currentId)
  return stillPresent ? currentId : defaultId
}

/* ─── Props ─── */

interface BookingPosProps {
  onSuccess: () => void
  onCancel: () => void
}

/* ─── Main component ─── */

export function BookingPos({ onSuccess, onCancel }: BookingPosProps) {
  const { t, locale } = useLocale()
  const [openSection, setOpenSection] = useState<SectionId>("client")

  // Phase 3 — "احجز من الرصيد" toggle. When true, submit posts to
  // /dashboard/bookings/from-credit instead of /dashboard/bookings.
  const [useCredit, setUseCredit] = useState(false)
  const [creditDismissed, setCreditDismissed] = useState(false)

  const { branches } = useBranches()
  const mainBranch = branches.find((b) => b.isMain) ?? branches[0]
  const { data: bookingSettings } = useBookingSettings()
  const maxAdvanceDays = bookingSettings?.maxAdvanceBookingDays ?? 90
  // W2-T2 — read payment settings so the "Pay at Clinic" option can be
  // disabled (and `payAtClinic` forced to false) when the org has
  // turned this payment mode off. While settings are still loading
  // (`undefined`) we MUST preserve today's behavior — do not force,
  // do not disable — so a slow network cannot silently turn a
  // reception default into a paid booking.
  const { data: paymentSettings } = usePaymentSettings()
  const queryClient = useQueryClient()

  const {
    state, isComplete, reset, selectClient, selectTrack, selectDepartment,
    selectCategory, selectService, selectEmployee, selectDeliveryType,
    selectDurationOption, selectDate, selectTime, selectProgram,
    setPayAtClinic, setCollectionMethod, setCouponCode,
    applyCreditTarget, applyPackageCreditTarget,
    applyCreditFilter, clearCreditFilter,
  } = useBookingFormState()

  const { submit: handleSubmit, isSubmitting } = useBookingPosSubmit({
    state, mainBranch, useCredit, reset, onSuccess,
  })

  const {
    isServiceAutoSelected, summaries, canShowTypeDuration, canShowDatetime,
    serviceTypes, servicePriceHalalas, selectedDurationMins,
    durationSummaryLabel, creditBadgeReady,
  } = useBookingPosDerived({ state, t, locale })

  const {
    handleUseCredit, handleTrackSelect, handlePackageCreditSelected,
    handleFlexibleCreditSelected, handleClearCreditFilter,
    handleProgramEnrolled,
  } = useBookingPosTrackHandlers({
    setOpenSection, setUseCredit, setCreditDismissed, reset, onSuccess,
    applyCreditTarget, selectTrack, applyPackageCreditTarget,
    applyCreditFilter, clearCreditFilter, selectProgram,
  })

  const {
    handleClientSelect, handleDepartmentSelect, handleServiceSelect,
    handleEmployeeSelect, handleSelectDeliveryType, handleSelectDuration,
    handleCategorySelect,
  } = useBookingPosSelectionHandlers({
    state, setOpenSection, setUseCredit, setCreditDismissed,
    queryClient, locale, t, serviceTypes, resolvePreservedDurationOptionId,
    selectClient, selectDepartment, selectService, selectEmployee,
    selectDeliveryType, selectDurationOption, selectCategory,
  })

  return (
    <div className="flex flex-col gap-4 p-4 md:p-5">
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

      <div className="flex flex-col gap-6 md:flex-row">
        <BookingPosFormColumn
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
          branchId={mainBranch?.id ?? null}
          clientLabel={t("bookings.pos.section.client")}
          onClientSelect={handleClientSelect}
          onTrackSelect={handleTrackSelect}
          onUseCredit={handleUseCredit}
          onPackageCreditSelected={handlePackageCreditSelected}
          onFlexibleCreditSelected={handleFlexibleCreditSelected}
          onClearFilter={handleClearCreditFilter}
          onProgramEnrolled={handleProgramEnrolled}
          onDepartmentSelect={handleDepartmentSelect}
          onCategorySelect={handleCategorySelect}
          onServiceSelect={handleServiceSelect}
          onEmployeeSelect={handleEmployeeSelect}
          onSelectDeliveryType={handleSelectDeliveryType}
          onSelectDuration={handleSelectDuration}
          onSelectDate={selectDate}
          onSelectTime={selectTime}
          onAcceptCredit={() => { setUseCredit(true); setCreditDismissed(false) }}
          onDismissCredit={() => { setUseCredit(false); setCreditDismissed(true) }}
        />

        <div className="w-full shrink-0 md:w-80">
          <BookingSummary
            clientName={state.clientName}
            serviceName={state.serviceName}
            employeeName={state.employeeName}
            type={state.deliveryType}
            durationLabel={durationSummaryLabel}
            date={state.date}
            startTime={state.startTime}
            servicePriceHalalas={servicePriceHalalas}
            payAtClinic={state.payAtClinic}
            collectionMethod={state.collectionMethod}
            // W2-T2 — PACKAGES track and explicit package-credit
            // selection both post to /from-credit. Those bookings are
            // zero-priced and pre-paid, so any collection UI would be
            // misleading; hide the timing group + method picker.
            hideCollectionTiming={
              useCredit ||
              state.track === "PACKAGES" ||
              !!state.packagePurchaseId
            }
            paymentSettings={paymentSettings}
            couponCode={state.couponCode}
            submitting={isSubmitting}
            isComplete={isComplete}
            onTogglePayAtClinic={setPayAtClinic}
            onChangeCollectionMethod={setCollectionMethod}
            onCouponChange={setCouponCode}
            onSubmit={handleSubmit}
          />
        </div>
      </div>
    </div>
  )
}