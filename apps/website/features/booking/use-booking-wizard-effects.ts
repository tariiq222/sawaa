'use client';

import { useEffect, useRef } from 'react';
import { WizardStep } from '@sawaa/shared';
import type { EmployeeWithUser, Service, WizardEvent, WizardState } from '@sawaa/shared';
import type { PublicBranch } from '@/features/booking/booking.api';
import type { UiAction, UiState } from '@/features/booking/booking-wizard-state';

type MachineDispatch = (event: WizardEvent) => void;
type UiDispatch = (action: UiAction) => void;

/**
 * React effects for the booking wizard. Kept apart from the pure derivations
 * and the network hooks so the composition hook stays readable. Behaviour is
 * unchanged: same guards, same dependencies, same dispatch order.
 */

export function useDeepLinkPreselect(input: {
  dispatch: MachineDispatch;
  dispatchUi: UiDispatch;
  loadingData: boolean;
  employees: EmployeeWithUser[];
  services: Service[];
  branches: PublicBranch[];
  preselectEmployeeId: string | null;
  preselectServiceId: string | null;
  preselectBranchId: string | null;
  onDone: (done: boolean) => void;
}) {
  const didPreselectRef = useRef(false);
  const {
    dispatch, dispatchUi, loadingData, employees, services, branches,
    preselectEmployeeId, preselectServiceId, preselectBranchId, onDone,
  } = input;

  // Deep-link handling
  //
  // - `?serviceId=` only         → select service, land on THERAPIST.
  // - `?employeeId=` only        → lock therapist; entry=therapist; user picks
  //                                 branch first (if multi) then service.
  // - both                        → select service, then apply therapist and go
  //                                 straight to branch/slot.
  useEffect(() => {
    if (didPreselectRef.current) return;
    if (loadingData) return;
    if (!preselectEmployeeId && !preselectServiceId && !preselectBranchId) {
      didPreselectRef.current = true;
      onDone(true);
      return;
    }
    const svc = preselectServiceId
      ? services.find((s) => s.id === preselectServiceId)
      : null;
    const emp = preselectEmployeeId
      ? employees.find((e) => e.id === preselectEmployeeId)
      : null;

    // Branch resolution priority:
    //   1) explicit ?branchId= in the URL
    //   2) the therapist's only branch (deep-link from therapist profile)
    //   3) the single branch in the system (when there's only one anyway)
    let branch: PublicBranch | null = null;
    if (preselectBranchId) {
      branch = branches.find((b) => b.id === preselectBranchId) ?? null;
    }
    if (!branch && emp?.branchIds && emp.branchIds.length === 1) {
      branch = branches.find((b) => b.id === emp.branchIds![0]) ?? null;
    }
    if (!branch && branches.length === 1) {
      branch = branches[0];
    }
    // Always resolve to a branch so the wizard never starts without one.
    // Prefer the branch the API marks as main; fall back to position 0.
    if (!branch) {
      branch = branches.find((b) => b.isMain) ?? branches[0] ?? null;
    }
    if (branch) {
      dispatchUi({ type: 'PICK_BRANCH', branch });
    }

    if (svc) dispatch({ type: 'SELECT_SERVICE', service: svc });

    if (emp) {
      if (svc) {
        dispatch({ type: 'SELECT_EMPLOYEE', employee: emp });
      } else {
        // Therapist-only deep link → lock until a service is picked.
        dispatchUi({ type: 'LOCK_EMPLOYEE', employee: emp });
      }
    }

    didPreselectRef.current = true;
    onDone(true);
  }, [
    loadingData,
    employees,
    services,
    branches,
    preselectEmployeeId,
    preselectServiceId,
    preselectBranchId,
    dispatch,
    dispatchUi,
    onDone,
  ]);
}

/** Auto-select the main branch on the no-params entry path. */
export function useMainBranchAutoSelect(input: {
  dispatchUi: UiDispatch;
  loadingData: boolean;
  preselectDone: boolean;
  selectedBranch: PublicBranch | null;
  branches: PublicBranch[];
}) {
  const { dispatchUi, loadingData, preselectDone, selectedBranch, branches } = input;
  useEffect(() => {
    if (loadingData) return;
    if (!preselectDone) return;
    if (selectedBranch) return;      // already resolved (deep-link or prior run)
    if (branches.length === 0) return;
    const main = branches.find((b) => b.isMain) ?? branches[0];
    dispatchUi({ type: 'PICK_BRANCH', branch: main });
  }, [loadingData, preselectDone, selectedBranch, branches, dispatchUi]);
}

/**
 * Mount/unmount tracking for practitioner-options loads. On unmount bump the
 * generation so any in-flight resolve/fail sees a stale id and bails before
 * dispatching UI updates into an unmounted tree.
 */
export function useWizardMountedRef(
  mountedRef: { current: boolean },
  practitionerOptionsRequestRef: { current: number },
) {
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      practitionerOptionsRequestRef.current += 1;
    };
  }, [mountedRef, practitionerOptionsRequestRef]);
}

/** Clear a stale choice flag once the machine has advanced past the choice point. */
export function useChoiceStepFlagCleanup(input: {
  dispatchUi: UiDispatch;
  state: WizardState;
  showingChoiceStep: boolean;
}) {
  const { dispatchUi, state, showingChoiceStep } = input;
  // Belt-and-braces: if the machine reaches INFO_OTP/PAYMENT while the choice
  // flag is still true (e.g. user advanced directly to a slot radio without
  // confirming a choice option), clear it so state and view agree. Only fires
  // when the flag is actually true, so it does not loop.
  useEffect(() => {
    if (
      showingChoiceStep &&
      (state.step === WizardStep.INFO_OTP || state.step === WizardStep.PAYMENT)
    ) {
      dispatchUi({ type: 'EXIT_CHOICE_STEP' });
    }
  }, [state.step, showingChoiceStep, dispatchUi]);
}

/** Auto-skip a one-therapist service straight into the choice screen. */
export function useSingleTherapistAutoSkip(input: {
  entryPoint: UiState['entryPoint'];
  state: WizardState;
  loadingData: boolean;
  filteredTherapists: EmployeeWithUser[];
  service: Service | null;
  autoSelectedPairRef: { current: string | null };
  selectTherapistAndLoadOptions: (emp: EmployeeWithUser) => Promise<void> | void;
}) {
  const {
    entryPoint, state, loadingData, filteredTherapists, service,
    autoSelectedPairRef, selectTherapistAndLoadOptions,
  } = input;
  // Auto-skip therapist step if the chosen service has exactly one offering
  // therapist — there's no real therapist choice to make. The dedicated
  // choice screen is still shown so the user explicitly commits
  // duration/attendance/price, and practitioner options are loaded exactly
  // once for that single therapist.
  //
  // Applies only to service-first flow. Branch is always pre-selected in the
  // new model, so we never open a branch picker.
  useEffect(() => {
    if (entryPoint !== 'service') return;
    if (state.step !== WizardStep.THERAPIST) return;
    if (loadingData) return;
    if (filteredTherapists.length !== 1) return;
    const only = filteredTherapists[0];
    const pairKey = `${service?.id ?? ''}::${only.id}`;
    if (autoSelectedPairRef.current === pairKey) return;
    autoSelectedPairRef.current = pairKey;
    void selectTherapistAndLoadOptions(only);
    // selectTherapistAndLoadOptions is intentionally NOT in the deps: it is
    // recreated on every render and depends on closures already captured
    // here. The pair-key ref + filteredTherapists guard re-runs prevent
    // infinite loops.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entryPoint, state.step, loadingData, filteredTherapists, service, autoSelectedPairRef]);
}

/** Snap the selected date forward to the first day with open slots. */
export function useBookableDateSnap(input: {
  dispatchUi: UiDispatch;
  state: WizardState;
  employee: EmployeeWithUser | null;
  selectedDate: string;
  availabilityDays: Array<{ date: string; hasSlots: boolean }>;
  bookableDates: ReadonlySet<string>;
}) {
  const { dispatchUi, state, employee, selectedDate, availabilityDays, bookableDates } = input;
  // Uses the per-day probe; falls back to the employee's weekday rules until
  // the probe lands. Prevents the user starting on a guaranteed-dead day.
  useEffect(() => {
    if (state.step !== WizardStep.SLOT) return;
    if (!employee) return;
    if (availabilityDays.length === 0) return;
    if (bookableDates.has(selectedDate)) return;
    const first = availabilityDays.find((d) => d.hasSlots);
    if (first) dispatchUi({ type: 'SET_DATE', date: first.date });
  }, [state.step, employee, selectedDate, availabilityDays, bookableDates, dispatchUi]);
}
