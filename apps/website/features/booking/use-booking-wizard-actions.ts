'use client';

import type { AvailableSlot, EmployeeWithUser, Service, WizardEvent, WizardState } from '@sawaa/shared';
import type { PublicBranch } from '@/features/booking/booking.api';
import type { SummaryScreen } from '@/features/booking/summary-rail';
import type {
  TransitionContext,
  TransitionOp,
} from '@/features/booking/booking-wizard-transitions';
import type { UiAction, UiState } from '@/features/booking/booking-wizard-state';

type MachineDispatch = (event: WizardEvent) => void;
type UiDispatch = (action: UiAction) => void;

export type WizardHandlerInput = {
  dispatch: MachineDispatch;
  dispatchUi: UiDispatch;
  entryPoint: UiState['entryPoint'];
  machineState: WizardState;
  ui: UiState;
  service: Service | null;
  employee: EmployeeWithUser | null;
  lockedEmployee: EmployeeWithUser | null;
  pendingEmployee: EmployeeWithUser | null;
  preselectServiceId: string | null;
  isSubmitting: boolean;
  loadPractitionerOptions: (svcId: string, empId: string) => void;
  invalidatePractitionerOptionsLoad: () => void;
  resetAutoSelectedPair: () => void;
  closeWizard: () => void;
  planStepBack: (context: TransitionContext) => TransitionOp[];
  planJumpToScreen: (screen: SummaryScreen, context: TransitionContext) => TransitionOp[];
  planBranchSelect: (
    branch: PublicBranch,
    context: { service: Service | null; pendingEmployee: EmployeeWithUser | null },
  ) => TransitionOp[];
  planBranchCancel: (
    entryPoint: UiState['entryPoint'],
    lockedEmployee: EmployeeWithUser | null,
  ) => TransitionOp[];
};

/** Executes an ordered transition plan: the only place plans become dispatches. */
export function runTransition(ops: TransitionOp[], input: WizardHandlerInput) {
  for (const op of ops) {
    if (op.kind === 'machine') input.dispatch(op.event);
    else if (op.kind === 'ui') input.dispatchUi(op.action);
    else if (op.effect === 'invalidate-practitioner-options') input.invalidatePractitionerOptionsLoad();
    else if (op.effect === 'reset-auto-selected-pair') input.resetAutoSelectedPair();
    else if (op.effect === 'close') input.closeWizard();
  }
}

/**
 * Select a service. Duration/attendance/price are decided later on the
 * dedicated choice screen — this handler never pre-commits a service-level
 * choice and always clears any stale `selectedChoice` from a prior flow.
 */
export function createServiceSelectHandler(input: WizardHandlerInput) {
  return async (svc: Service) => {
    input.dispatch({ type: 'SELECT_SERVICE', service: svc });
    input.dispatchUi({ type: 'CLEAR_PAYMENT_RECOVERY' });
    // Always clear stale choices: the dedicated choice screen is the only
    // place the user commits { durationOptionId, deliveryType }.
    input.dispatchUi({ type: 'SET_CHOICE', choice: null });
    // Clear the single-therapist latch so re-selecting this service (or any
    // service) on a fresh entry lets the auto-skip re-fire if applicable.
    input.resetAutoSelectedPair();
    const carriedTherapist = input.lockedEmployee;
    if (carriedTherapist) {
      input.dispatch({ type: 'SELECT_EMPLOYEE', employee: carriedTherapist });
      input.dispatchUi({ type: 'CLEAR_LOCKED_EMPLOYEE' });
      input.loadPractitionerOptions(svc.id, carriedTherapist.id);
    }
  };
}

export function createTherapistHandlers(input: WizardHandlerInput) {
  /**
   * Select a therapist and enter the dedicated choice screen while
   * practitioner options load. Used both by manual selection and the
   * single-therapist auto-skip so both paths take exactly one fetch.
   */
  const selectTherapistAndLoadOptions = async (emp: EmployeeWithUser) => {
    input.dispatch({ type: 'SELECT_EMPLOYEE', employee: emp });
    if (!input.service) return;
    // Clear the prior therapist's choice so the committed-only summary never
    // mixes the previous therapist's duration/delivery/total with the new one.
    input.dispatchUi({ type: 'SET_CHOICE', choice: null });
    input.loadPractitionerOptions(input.service.id, emp.id);
  };

  const handleTherapistSelect = async (emp: EmployeeWithUser) => {
    if (input.entryPoint === 'therapist') {
      input.dispatchUi({ type: 'LOCK_EMPLOYEE', employee: emp });
      input.dispatchUi({ type: 'THERAPIST_STEP_DONE' });
      return;
    }
    await selectTherapistAndLoadOptions(emp);
  };

  return { selectTherapistAndLoadOptions, handleTherapistSelect };
}

export function createChoiceConfirmHandler(input: WizardHandlerInput) {
  return (choice: { durationOptionId: string; deliveryType: 'IN_PERSON' | 'ONLINE' }) => {
    input.dispatchUi({ type: 'SET_CHOICE', choice });
    input.dispatchUi({ type: 'EXIT_CHOICE_STEP' });
  };
}

export function createBranchHandlers(input: WizardHandlerInput) {
  const handleBranchSelect = (branch: PublicBranch) => {
    runTransition(
      input.planBranchSelect(branch, { service: input.service, pendingEmployee: input.pendingEmployee }),
      input,
    );
  };
  const handleBranchCancel = () => {
    runTransition(input.planBranchCancel(input.entryPoint, input.lockedEmployee), input);
  };
  return { handleBranchSelect, handleBranchCancel };
}

export function createStepBackHandler(input: WizardHandlerInput) {
  const context = {
    state: input.machineState,
    ui: input.ui,
    service: input.service,
    employee: input.employee,
    preselectServiceId: input.preselectServiceId,
    isSubmitting: input.isSubmitting,
  };
  return () => runTransition(input.planStepBack(context), input);
}

export function createJumpToScreenHandler(input: WizardHandlerInput) {
  const context = {
    state: input.machineState,
    ui: input.ui,
    service: input.service,
    employee: input.employee,
    preselectServiceId: input.preselectServiceId,
    isSubmitting: input.isSubmitting,
  };
  return (screen: SummaryScreen) => runTransition(input.planJumpToScreen(screen, context), input);
}

export function createSimpleHandlers(input: WizardHandlerInput) {
  return {
    handleBookAnother: () => {
      input.dispatch({ type: 'RESET' });
      input.dispatchUi({ type: 'CLEAR_COMPLETION' });
    },
    handleStartOverFromRecovery: () => {
      input.dispatch({ type: 'RESET' });
      input.dispatchUi({ type: 'CLEAR_PAYMENT_RECOVERY' });
    },
    handleSetDate: (iso: string) => input.dispatchUi({ type: 'SET_DATE', date: iso }),
    handleSelectSlot: (s: AvailableSlot) => input.dispatch({ type: 'SELECT_SLOT', slot: s }),
    handleClearLockedEmployee: () => input.dispatchUi({ type: 'CLEAR_LOCKED_EMPLOYEE' }),
    handleBackFromInfo: () => {
      if (input.employee) input.dispatch({ type: 'SELECT_EMPLOYEE', employee: input.employee });
    },
  };
}
