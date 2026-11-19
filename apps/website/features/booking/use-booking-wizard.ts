'use client';

import { useMemo, useReducer, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { reduce, INITIAL_WIZARD_STATE } from '@sawaa/shared';
import { useT, useLocale } from '@/features/locale/locale-provider';
import {
  INITIAL_UI_STATE,
  uiReducer,
  buildFlow,
} from '@/features/booking/booking-wizard-state';
import {
  useBookingAvailability,
  useBookingCatalogData,
} from '@/features/booking/booking-wizard-data';
import {
  deriveLockedTherapistName,
  deriveWizardSelection,
} from '@/features/booking/booking-wizard-derived';
import { useBookingWizardPools } from '@/features/booking/use-booking-wizard-pools';
import { useBookingWizardView } from '@/features/booking/use-booking-wizard-view';
import {
  planBranchCancel,
  planBranchSelect,
  planJumpToScreen,
  planStepBack,
} from '@/features/booking/booking-wizard-transitions';
import { submitBooking } from '@/features/booking/booking-submission';
import {
  useBookableDateSnap,
  useChoiceStepFlagCleanup,
  useDeepLinkPreselect,
  useMainBranchAutoSelect,
  useSingleTherapistAutoSkip,
} from '@/features/booking/use-booking-wizard-effects';
import { usePractitionerOptions } from '@/features/booking/use-practitioner-options';
import { useBookingWizardHandlers } from '@/features/booking/use-booking-wizard-handlers';

/**
 * Composition root for the website booking wizard.
 *
 * The work is split so each concern can be read (and tested) on its own:
 *   - `booking-wizard-derived.ts`      — pure derivations, no React/I/O
 *   - `booking-wizard-transitions.ts`  — pure navigation plans (ordered ops)
 *   - `booking-wizard-data.ts`         — network/query reads only
 *   - `booking-submission.ts`          — payload build + submit + outcome mapping
 *   - `use-practitioner-options.ts`    — imperative options fetch + races
 *   - `use-booking-wizard-actions.ts`  — handlers that execute transition plans
 *   - `use-booking-wizard-effects.ts`  — the React effects, unchanged in order
 *
 * This file only wires them together and returns the same public shape the
 * booking components consumed before the split.
 */
export function useBookingWizard() {
  const t = useT();
  const locale = useLocale();
  const isAr = locale === 'ar';
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectEmployeeId = searchParams.get('employeeId');
  const preselectServiceId = searchParams.get('serviceId');
  const preselectCategoryId = searchParams.get('categoryId');
  const preselectBranchId = searchParams.get('branchId');
  const [state, dispatch] = useReducer(reduce, INITIAL_WIZARD_STATE);
  const [ui, dispatchUi] = useReducer(uiReducer, {
    ...INITIAL_UI_STATE,
    // Entry point is decided from URL — if we landed with ?employeeId= and no
    // ?serviceId=, treat the therapist as the anchor of the flow.
    entryPoint: preselectEmployeeId && !preselectServiceId ? 'therapist' : 'service',
  });
  // Bounded latch: remembers the (service.id, therapist.id) pair we already
  // auto-selected via the single-therapist shortcut so the effect does not
  // re-fire when the machine advances past THERAPIST and re-renders with the
  // same pair. Cleared whenever the user re-enters service selection so
  // returning to the same service after a back-out still auto-selects the
  // sole therapist and opens the dedicated choice step (not a parking
  // therapist screen).
  const autoSelectedPairRef = useRef<string | null>(null);
  const [preselectDone, setPreselectDone] = useState(false);
  const {
    entryPoint,
    pendingEmployee,
    lockedEmployee,
    selectedBranch,
    selectedDate,
    selectedChoice,
    isSubmitting,
    submitError,
    redirectUrl,
    bookingId,
    paymentRecovery,
    practitionerOptions,
    practitionerOptionsLoading,
    showingChoiceStep,
  } = ui;

  const {
    employees,
    services,
    categories,
    branches,
    vatRate,
    loadingData,
    initialLoadError,
    paymentMethods,
    paymentMethodsLoading,
  } = useBookingCatalogData();

  // Single-branch center: the branch step is never shown; the main branch is
  // auto-selected by the effects below and submitted transparently.
  const hasBranchStep = false;

  useDeepLinkPreselect({
    dispatch,
    dispatchUi,
    loadingData,
    employees,
    services,
    branches,
    preselectEmployeeId,
    preselectServiceId,
    preselectBranchId,
    onDone: setPreselectDone,
  });
  useMainBranchAutoSelect({
    dispatchUi,
    loadingData,
    preselectDone,
    selectedBranch,
    branches,
  });
  const { loadPractitionerOptions, invalidatePractitionerOptionsLoad } =
    usePractitionerOptions(dispatchUi);
  const resetAutoSelectedPair = () => {
    autoSelectedPairRef.current = null;
  };

  useChoiceStepFlagCleanup({ dispatchUi, state, showingChoiceStep });

  const { service, employee, slot } = deriveWizardSelection(state);

  // selectedBranch is always set by the auto-select effects above; the fallback
  // inside the view hook covers the brief window before data loads.
  const effectiveBranchId = (selectedBranch ?? branches.find((b) => b.isMain) ?? branches[0])?.id;

  // The visible flow (stepper) for the current entry point.
  const flow = useMemo(
    () => buildFlow(entryPoint),
    [entryPoint],
  );

  const {
    slots,
    loadingSlots,
    slotsError,
    availabilityDays,
    availabilityDaysError,
    bookableDates,
  } = useBookingAvailability({
    state,
    employeeId: employee?.id,
    serviceId: service?.id,
    branchId: effectiveBranchId,
    selectedDate,
    selectedChoice,
  });
  const loadError = initialLoadError ?? slotsError ?? availabilityDaysError;

  const handleClose = () => {
    // Always exit booking to a known destination. Using router.back() is unreliable
    // when the referrer was the booking flow itself (deep links, internal navigation).
    const referrer = typeof document !== 'undefined' ? document.referrer : '';
    const sameOrigin =
      referrer &&
      typeof window !== 'undefined' &&
      referrer.startsWith(window.location.origin) &&
      !referrer.includes('/booking');
    if (sameOrigin) {
      router.back();
    } else {
      router.push('/');
    }
  };
  const {
    handleServiceSelect,
    selectTherapistAndLoadOptions,
    handleTherapistSelect,
    handleChoiceConfirm,
    handleBranchSelect,
    handleBranchCancel,
    handleStepBack,
    jumpToScreen,
    handleBookAnother,
    handleStartOverFromRecovery,
    handleSetDate,
    handleSelectSlot,
    handleClearLockedEmployee,
    handleBackFromInfo,
  } = useBookingWizardHandlers({
    dispatch,
    dispatchUi,
    state,
    ui,
    service,
    employee,
    lockedEmployee,
    pendingEmployee,
    preselectServiceId,
    isSubmitting,
    loadPractitionerOptions,
    invalidatePractitionerOptionsLoad,
    resetAutoSelectedPair,
    closeWizard: handleClose,
    planStepBack,
    planJumpToScreen,
    planBranchSelect,
    planBranchCancel,
  });

  const { filteredServices, filteredTherapists, nothingBookable } = useBookingWizardPools({
    employees,
    services,
    categories,
    branches,
    selectedBranch,
    lockedEmployee,
    service,
    loadError,
    loadingData,
  });

  useSingleTherapistAutoSkip({
    entryPoint,
    state,
    loadingData,
    filteredTherapists,
    service,
    autoSelectedPairRef,
    selectTherapistAndLoadOptions,
  });
  useBookableDateSnap({
    dispatchUi,
    state,
    employee,
    selectedDate,
    availabilityDays,
    bookableDates,
  });

  const lockedTherapistName = deriveLockedTherapistName(lockedEmployee);

  // Once a booking exists, freeze its selections and require the explicit
  // "book another" action before reopening the wizard for a new booking.
  const canStepBack = paymentRecovery === null;

  const {
    currentScreen,
    stepIndex,
    stepLabels,
    isConfirmation,
    confirmationSucceeded,
    screenKey,
    showSummary,
    summaryProps,
    selectedPriceHalalas,
    branchStepBranches,
  } = useBookingWizardView({
    state,
    ui,
    flow,
    t,
    service,
    employee,
    slot,
    selectedChoice,
    selectedBranch,
    branches,
    pendingEmployee,
    lockedEmployee,
    nothingBookable,
    vatRate,
    practitionerOptions,
    hasBranchStep,
    onEdit: jumpToScreen,
  });

  const handleSubmitInfo = async (payAtClinic: boolean) => {
    await submitBooking(
      {
        effectiveBranchId,
        service,
        employee,
        slot,
        selectedChoice,
        paymentRecovery,
        payAtClinic,
        t,
      },
      dispatchUi,
    );
  };

  return {
    t,
    isAr,
    readyToRedirect: Boolean(redirectUrl && bookingId),
    redirectUrl,
    bookingId,
    nothingBookable,
    isConfirmation,
    confirmationSucceeded,
    showSummary,
    screenKey,
    stepIndex,
    stepLabels,
    loadError,
    submitError,
    paymentRecovery,
    summaryProps,
    currentScreen,
    loadingData,
    paymentMethods,
    paymentMethodsLoading,
    filteredServices,
    categories,
    filteredTherapists,
    branchStepBranches,
    lockedTherapistName,
    entryPoint,
    preselectCategoryId,
    service,
    employee,
    slot,
    practitionerOptions,
    practitionerOptionsLoading,
    vatRate,
    selectedDate,
    slots,
    loadingSlots,
    bookableDates,
    selectedPriceHalalas,
    isSubmitting,
    canStepBack,
    handleClose,
    handleStepBack,
    handleServiceSelect,
    handleTherapistSelect,
    handleChoiceConfirm,
    handleBranchSelect,
    handleBranchCancel,
    handleSubmitInfo,
    handleBookAnother,
    handleStartOverFromRecovery,
    handleSetDate,
    handleSelectSlot,
    handleClearLockedEmployee,
    handleBackFromInfo,
    jumpToScreen,
  };
}
