import { WizardStep } from '@sawaa/shared';
import type { EmployeeWithUser, Service, WizardEvent, WizardState } from '@sawaa/shared';
import type { PublicBranch } from './booking.api';
import type { SummaryScreen } from './summary-rail';
import type { UiAction, UiState } from './booking-wizard-state';

/**
 * Pure navigation transitions.
 *
 * Each handler returns an ordered plan of operations instead of executing
 * them, so the exact sequence (machine events, UI actions, side-effect
 * intents) is data and can be asserted without React, timers or network.
 * No React, no effects, no I/O here.
 */

export type WizardEffect = 'invalidate-practitioner-options' | 'reset-auto-selected-pair' | 'close';

export type TransitionOp =
  | { kind: 'machine'; event: WizardEvent }
  | { kind: 'ui'; action: UiAction }
  | { kind: 'effect'; effect: WizardEffect };

export type TransitionContext = {
  state: WizardState;
  ui: UiState;
  service: Service | null;
  employee: EmployeeWithUser | null;
  preselectServiceId: string | null;
  isSubmitting: boolean;
};

/**
 * Step-back: go to the previous wizard screen. Mirrors the flow order.
 * On the very first screen it exits the booking flow (same as the close button).
 */
export function planStepBack(context: TransitionContext): TransitionOp[] {
  const { state, ui, service, employee, preselectServiceId } = context;
  const ops: TransitionOp[] = [];
  // The confirmation screen is terminal (like the shared machine's
  // CONFIRMATION step) — the only exits are "book another" (RESET) or close.
  if (ui.confirmed || ui.paymentRecovery) return ops;
  if (ui.awaitingBranch) {
    // Branch picker was opened via the change-branch affordance or summary
    // rail edit. Pressing back cancels the change and returns to the current
    // step — the branch that was selected before stays unchanged.
    ops.push({ kind: 'ui', action: { type: 'CANCEL_BRANCH_PICK' } });
    return ops;
  }
  if (ui.showingChoiceStep) {
    ops.push({ kind: 'ui', action: { type: 'EXIT_CHOICE_STEP' } });
    // Invalidate any in-flight load so a late response cannot repopulate
    // options on the therapist screen we are returning to — even if no
    // replacement request is starting.
    ops.push({ kind: 'effect', effect: 'invalidate-practitioner-options' });
    ops.push({ kind: 'ui', action: { type: 'SET_PRACTITIONER_OPTIONS', opts: null } });
    // Clear the single-therapist latch so going back from the choice step
    // with exactly one therapist re-fires the auto-skip and routes the user
    // back through the dedicated choice screen (not a parking therapist
    // step from which they cannot advance).
    ops.push({ kind: 'effect', effect: 'reset-auto-selected-pair' });
    if (service) ops.push({ kind: 'machine', event: { type: 'SELECT_SERVICE', service } });
    return ops;
  }
  // Therapist-first: back from service → return to therapist screen
  if (ui.entryPoint === 'therapist' && ui.therapistStepDone && state.step === WizardStep.SERVICE) {
    ops.push({ kind: 'ui', action: { type: 'THERAPIST_STEP_UNDONE' } });
    ops.push({ kind: 'ui', action: { type: 'SET_CHOICE', choice: null } });
    return ops;
  }
  switch (state.step) {
    case WizardStep.SERVICE:
      // First content step. Branch is auto-selected — pressing back exits
      // the booking flow. The user can change the branch via the affordance.
      ops.push({ kind: 'effect', effect: 'close' });
      break;
    case WizardStep.THERAPIST:
      if ((service as (Service & { isHidden?: boolean }) | null)?.isHidden && preselectServiceId === service?.id) {
        ops.push({ kind: 'effect', effect: 'close' });
        break;
      }
      // Back to service picker.
      ops.push({ kind: 'machine', event: { type: 'RESET' } });
      ops.push({ kind: 'ui', action: { type: 'SET_CHOICE', choice: null } });
      // No in-flight load expected here (choice was never entered), but
      // invalidate for symmetry — keeps the contract uniform across paths
      // that drop the therapist context.
      ops.push({ kind: 'effect', effect: 'invalidate-practitioner-options' });
      break;
    case WizardStep.SLOT:
      // Back to therapist picker — the underlying machine drops back to
      // THERAPIST. For services with exactly one therapist, the auto-skip
      // below will re-fire and route the user through the dedicated
      // choice step so they can revise duration/delivery/total — they do
      // NOT return directly to the slot screen. The latch must be reset;
      // otherwise the auto-skip would see the same (service, therapist)
      // pair and park the user on the therapist step with no way to
      // advance.
      if (state.service) ops.push({ kind: 'machine', event: { type: 'SELECT_SERVICE', service: state.service } });
      ops.push({ kind: 'effect', effect: 'reset-auto-selected-pair' });
      // Symmetric invalidation: if the user backed out of choice before
      // the first load resolved, this guarantees the in-flight resolve
      // cannot write options to the therapist picker we are returning to.
      ops.push({ kind: 'effect', effect: 'invalidate-practitioner-options' });
      break;
    case WizardStep.INFO_OTP:
    case WizardStep.PAYMENT:
      // Back from info/payment → return to the slot picker.
      if (state.employee) ops.push({ kind: 'machine', event: { type: 'SELECT_EMPLOYEE', employee: state.employee } });
      else if (employee) ops.push({ kind: 'machine', event: { type: 'SELECT_EMPLOYEE', employee } });
      break;
    default:
      break;
  }
  return ops;
}

/**
 * Jump back to a completed step from the live summary. Reuses the exact
 * transitions the step-back handler performs, so the state machine stays
 * consistent. Changing the branch restarts the funnel (services and
 * therapists vary per branch).
 */
export function planJumpToScreen(screen: SummaryScreen, context: TransitionContext): TransitionOp[] {
  const { service, employee } = context;
  const ops: TransitionOp[] = [];
  if (context.isSubmitting || context.ui.paymentRecovery) return ops;
  switch (screen) {
    case 'branch':
      ops.push({ kind: 'machine', event: { type: 'RESET' } });
      ops.push({ kind: 'ui', action: { type: 'SET_CHOICE', choice: null } });
      ops.push({ kind: 'ui', action: { type: 'OPEN_INITIAL_BRANCH_PICK' } });
      break;
    case 'service':
      ops.push({ kind: 'machine', event: { type: 'RESET' } });
      ops.push({ kind: 'ui', action: { type: 'SET_CHOICE', choice: null } });
      break;
    case 'therapist':
      if (service) ops.push({ kind: 'machine', event: { type: 'SELECT_SERVICE', service } });
      ops.push({ kind: 'ui', action: { type: 'EXIT_CHOICE_STEP' } });
      // Invalidate any in-flight load so a late response cannot repopulate
      // options on the therapist screen we are returning to.
      ops.push({ kind: 'effect', effect: 'invalidate-practitioner-options' });
      ops.push({ kind: 'ui', action: { type: 'SET_PRACTITIONER_OPTIONS', opts: null } });
      // Allow the single-therapist auto-skip to re-evaluate with fresh
      // therapist data when the user re-enters the therapist screen.
      ops.push({ kind: 'effect', effect: 'reset-auto-selected-pair' });
      break;
    case 'slot':
      if (employee) ops.push({ kind: 'machine', event: { type: 'SELECT_EMPLOYEE', employee } });
      break;
    default:
      break;
  }
  return ops;
}

export function planBranchSelect(
  branch: PublicBranch,
  context: { service: Service | null; pendingEmployee: EmployeeWithUser | null },
): TransitionOp[] {
  const ops: TransitionOp[] = [{ kind: 'ui', action: { type: 'PICK_BRANCH', branch } }];
  // If a service is already set, finalize SELECT_EMPLOYEE now so the state
  // machine advances. If not (therapist-first, no service yet), the chosen
  // therapist stays in `lockedEmployee` and we land back on the service
  // screen.
  if (context.service && context.pendingEmployee) {
    ops.push({ kind: 'machine', event: { type: 'SELECT_EMPLOYEE', employee: context.pendingEmployee } });
    ops.push({ kind: 'ui', action: { type: 'CLEAR_LOCKED_EMPLOYEE' } });
  }
  return ops;
}

export function planBranchCancel(entryPoint: UiState['entryPoint'], lockedEmployee: EmployeeWithUser | null): TransitionOp[] {
  const ops: TransitionOp[] = [{ kind: 'ui', action: { type: 'CANCEL_BRANCH_PICK' } }];
  if (entryPoint === 'therapist' && lockedEmployee) {
    // From the branch screen in therapist-first mode, "back" returns to the
    // therapist list. Clearing the lock lets the user pick a different one.
    ops.push({ kind: 'ui', action: { type: 'CLEAR_LOCKED_EMPLOYEE' } });
  }
  return ops;
}
