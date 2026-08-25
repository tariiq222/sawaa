// W4-T13 — extracted from booking-pos.tsx on 2026-08-25. Owns the
// wizard's track / credit / program handlers (Phase 3 "احجز من
// الرصيد" toggle, Phase 6 three-track selection, W2B-T8 FLEXIBLE
// vs. PINNED package routing, GROUP-track program enrollment).
// Pure move — handler bodies, comments, and shapes are unchanged.

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
  applyCreditTarget: (target: CreditTarget) => void
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
    applyCreditTarget, selectTrack, applyPackageCreditTarget,
    applyCreditFilter, clearCreditFilter, selectProgram,
  } = params

  const handleUseCredit = (target: CreditTarget) => {
    applyCreditTarget(target)
    setOpenSection("typeDuration")
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
    setOpenSection("typeDuration")
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