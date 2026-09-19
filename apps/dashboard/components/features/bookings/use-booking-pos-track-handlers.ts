// W4-T13 — extracted from booking-pos.tsx on 2026-08-25. Owns the
// wizard's track / credit / program handlers (Phase 3 "احجز من
// الرصيد" toggle, Phase 6 three-track selection, W2B-T8 FLEXIBLE
// vs. PINNED package routing, GROUP-track program enrollment).
//
// W6 fix — 2026-09-12 — `handleUseCredit` (the client-credits panel's
// jump button) converged onto the same PACKAGES-track path as
// `handlePackageCreditSelected`: it now selects the track and calls
// `applyPackageCreditTarget` instead of the trackless `applyCreditTarget`,
// which used to leave the wizard on no track with nothing rendered below
// النوع/الموعد. See client-credits-panel.tsx for the matching
// `packagePurchaseId` plumbing.

"use client"

import type {
  BookingTrack,
  CreditTarget,
} from "./use-booking-form-state"
import type { CreditFilter } from "@/lib/booking-credit-filter"
import type { SectionId } from "./pos-collapsible-section"

interface UseBookingPosTrackHandlersParams {
  setOpenSection: (id: SectionId) => void
  setUseCredit: (v: boolean) => void
  setCreditDismissed: (v: boolean) => void
  reset: () => void
  onSuccess: () => void
  selectTrack: (track: BookingTrack) => void
  applyPackageCreditTarget: (
    target: CreditTarget,
    packagePurchaseId: string,
  ) => void
  applyCreditFilter: (filter: CreditFilter) => void
  clearCreditFilter: () => void
  selectProgram: (programId: string, programName: string) => void
}

export function useBookingPosTrackHandlers(
  params: UseBookingPosTrackHandlersParams,
) {
  const {
    setOpenSection, setUseCredit, setCreditDismissed, reset, onSuccess,
    selectTrack, applyPackageCreditTarget,
    applyCreditFilter, clearCreditFilter, selectProgram,
  } = params

  // The client-credits panel button must land the operator in exactly the
  // same state as the designed path (pick PACKAGES track → pick this same
  // credit → handlePackageCreditSelected below). Previously this jump-filled
  // the target but never selected a track, so the wizard stayed on no track
  // and rendered no النوع/الموعد sections at all — a dead end. Converged onto
  // applyPackageCreditTarget (rather than the trackless applyCreditTarget) so
  // packagePurchaseId is recorded and submit hits /from-credit instead of
  // creating a paid booking for a session the client already covered.
  const handleUseCredit = (target: CreditTarget, packagePurchaseId: string) => {
    selectTrack("PACKAGES")
    applyPackageCreditTarget(target, packagePurchaseId)
    setUseCredit(true)
    setCreditDismissed(false)
    setOpenSection(target.deliveryType ? "datetime" : "typeDuration")
  }

  // Phase 6 — selecting a track resets every downstream pick and re-arms
  // the credit badge so a fresh suggestion can appear.
  const handleTrackSelect = (track: BookingTrack) => {
    selectTrack(track)
    setOpenSection(
      track === "CLINICS" ? "department" : track === "PACKAGES" ? "package" : "program",
    )
    setUseCredit(false)
    setCreditDismissed(false)
  }

  // Phase 6 — PACKAGES track: jump-fill the credit triple AND record
  // which purchase it came from so submit hits /from-credit.
  const handlePackageCreditSelected = (
    target: CreditTarget,
    packagePurchaseId: string,
  ) => {
    applyPackageCreditTarget(target, packagePurchaseId)
    setUseCredit(true)
    setOpenSection(target.deliveryType ? "datetime" : "typeDuration")
  }

  // W2B-T8 — PACKAGES track: the operator spent a FLEXIBLE credit.
  // Unlike the PINNED branch above, no fields are jump-filled: the
  // shell records the restriction and the operator picks inside it.
  // Mirrors `handlePackageCreditSelected` so `setUseCredit` /
  // `setOpenSection` follow the same conventions.
  const handleFlexibleCreditSelected = (filter: CreditFilter) => {
    applyCreditFilter(filter)
    setUseCredit(true)
    setOpenSection("department")
  }

  // W2B-T8 — clear the chip's restriction and bounce back to the
  // package step so the operator can re-pick a different credit (or
  // none). `clearCreditFilter` already nulls `packagePurchaseId` and
  // department-and-below.
  const handleClearCreditFilter = () => {
    clearCreditFilter()
    setUseCredit(false)
    setOpenSection("package")
  }

  // Phase 6 — GROUP track: StepProgram already fired the enrollment
  // mutation; close the wizard so handleSubmit can never create a
  // second booking.
  const handleProgramEnrolled = (programId: string, programName: string) => {
    selectProgram(programId, programName)
    reset()
    onSuccess()
  }

  return {
    handleUseCredit,
    handleTrackSelect,
    handlePackageCreditSelected,
    handleFlexibleCreditSelected,
    handleClearCreditFilter,
    handleProgramEnrolled,
  }
}
