'use client';

import { useMemo } from 'react';
import { WizardStep } from '@sawaa/shared';
import type { EmployeeWithUser, Service, WizardState } from '@sawaa/shared';
import type { MessageKey } from '@/features/locale/dictionary';
import type { PublicBranch } from '@/features/booking/booking.api';
import type { SummaryScreen } from '@/features/booking/summary-rail';
import type { UiState, WizardScreen } from '@/features/booking/booking-wizard-state';
import {
  deriveBranchStepBranches,
  deriveScreenKey,
  deriveStepLabels,
  deriveSummaryProps,
  isWizardConfirmationSucceeded,
  resolveCurrentScreen,
  resolveSelectedPriceHalalas,
  type WizardSummaryProps,
} from '@/features/booking/booking-wizard-derived';
import type { PractitionerBookingOptions } from '@/features/booking/booking.api';

/**
 * View-model derivations for the booking screen. Pure inputs, pure outputs;
 * keeps the composition hook from becoming a pile of `useMemo` blocks.
 */
export function useBookingWizardView(input: {
  state: WizardState;
  ui: Pick<
    UiState,
    'awaitingBranch' | 'showingChoiceStep' | 'entryPoint' | 'therapistStepDone' | 'confirmed' | 'paymentRecovery'
  >;
  flow: WizardScreen[];
  t: (key: MessageKey) => string;
  service: Service | null;
  employee: EmployeeWithUser | null;
  slot: import('@sawaa/shared').AvailableSlot | null;
  selectedChoice: UiState['selectedChoice'];
  selectedBranch: PublicBranch | null;
  branches: PublicBranch[];
  pendingEmployee: EmployeeWithUser | null;
  lockedEmployee: EmployeeWithUser | null;
  nothingBookable: boolean;
  vatRate: number;
  practitionerOptions: PractitionerBookingOptions | null;
  hasBranchStep: boolean;
  onEdit: (screen: SummaryScreen) => void;
}) {
  const { state, ui, flow, t, service, employee, slot, selectedChoice } = input;

  const serviceIsHidden = Boolean((service as (Service & { isHidden?: boolean }) | null)?.isHidden);
  const stepLabels = useMemo(
    () => deriveStepLabels(flow, t, serviceIsHidden),
    [flow, t, serviceIsHidden],
  );
  const currentScreen = useMemo(
    () => resolveCurrentScreen(state.step, {
      awaitingBranch: ui.awaitingBranch,
      showingChoiceStep: ui.showingChoiceStep,
      entryPoint: ui.entryPoint,
      therapistStepDone: ui.therapistStepDone,
    }),
    [state.step, ui.awaitingBranch, ui.showingChoiceStep, ui.entryPoint, ui.therapistStepDone],
  );
  const stepIndex = Math.max(0, flow.indexOf(currentScreen));

  const effectiveBranch =
    input.selectedBranch ?? input.branches.find((b) => b.isMain) ?? input.branches[0] ?? null;

  const isConfirmation = state.step === WizardStep.CONFIRMATION || ui.confirmed;
  const confirmationSucceeded = isWizardConfirmationSucceeded(state, ui.confirmed);
  const screenKey = deriveScreenKey({ nothingBookable: input.nothingBookable, isConfirmation, currentScreen });
  // The side summary lives next to the flow on desktop. The info step renders
  // its own receipt, so the rail bows out there to avoid saying things twice.
  const showSummary = !input.nothingBookable && !isConfirmation && currentScreen !== 'info';
  const summaryProps: WizardSummaryProps = deriveSummaryProps({
    effectiveBranch,
    hasBranchStep: input.hasBranchStep,
    service,
    selectedChoice,
    employee,
    slot,
    awaitingBranch: ui.awaitingBranch,
    currentScreen,
    vatRate: input.vatRate,
    practitionerOptions: input.practitionerOptions,
    onEdit: input.onEdit,
  });
  const selectedPriceHalalas = resolveSelectedPriceHalalas(selectedChoice, input.practitionerOptions, service);
  const branchStepBranches = deriveBranchStepBranches(input.pendingEmployee, input.lockedEmployee, input.branches);

  return {
    effectiveBranch,
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
  };
}
