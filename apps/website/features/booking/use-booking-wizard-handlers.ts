'use client';

import type { EmployeeWithUser, Service, WizardEvent, WizardState } from '@sawaa/shared';
import type { PublicBranch } from '@/features/booking/booking.api';
import type { SummaryScreen } from '@/features/booking/summary-rail';
import type { UiAction, UiState } from '@/features/booking/booking-wizard-state';
import type {
  TransitionContext,
  TransitionOp,
} from '@/features/booking/booking-wizard-transitions';
import {
  createBranchHandlers,
  createChoiceConfirmHandler,
  createJumpToScreenHandler,
  createServiceSelectHandler,
  createSimpleHandlers,
  createStepBackHandler,
  createTherapistHandlers,
  type WizardHandlerInput,
} from '@/features/booking/use-booking-wizard-actions';

export type BookingWizardHandlersConfig = {
  dispatch: (event: WizardEvent) => void;
  dispatchUi: (action: UiAction) => void;
  state: WizardState;
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

/**
 * Builds every wizard handler from one wiring object. Handlers themselves are
 * created by the pure factories in `use-booking-wizard-actions.ts`; this hook
 * only assembles them so the composition root stays a thin shell.
 */
export function useBookingWizardHandlers(config: BookingWizardHandlersConfig) {
  const input: WizardHandlerInput = {
    dispatch: config.dispatch,
    dispatchUi: config.dispatchUi,
    entryPoint: config.ui.entryPoint,
    machineState: config.state,
    ui: config.ui,
    service: config.service,
    employee: config.employee,
    lockedEmployee: config.lockedEmployee,
    pendingEmployee: config.pendingEmployee,
    preselectServiceId: config.preselectServiceId,
    isSubmitting: config.isSubmitting,
    loadPractitionerOptions: config.loadPractitionerOptions,
    invalidatePractitionerOptionsLoad: config.invalidatePractitionerOptionsLoad,
    resetAutoSelectedPair: config.resetAutoSelectedPair,
    closeWizard: config.closeWizard,
    planStepBack: config.planStepBack,
    planJumpToScreen: config.planJumpToScreen,
    planBranchSelect: config.planBranchSelect,
    planBranchCancel: config.planBranchCancel,
  };

  const handleServiceSelect = createServiceSelectHandler(input);
  const { selectTherapistAndLoadOptions, handleTherapistSelect } = createTherapistHandlers(input);
  const handleChoiceConfirm = createChoiceConfirmHandler(input);
  const { handleBranchSelect, handleBranchCancel } = createBranchHandlers(input);
  const handleStepBack = createStepBackHandler(input);
  const jumpToScreen = createJumpToScreenHandler(input);
  const simple = createSimpleHandlers(input);

  return {
    handleServiceSelect,
    selectTherapistAndLoadOptions,
    handleTherapistSelect,
    handleChoiceConfirm,
    handleBranchSelect,
    handleBranchCancel,
    handleStepBack,
    jumpToScreen,
    ...simple,
  };
}
