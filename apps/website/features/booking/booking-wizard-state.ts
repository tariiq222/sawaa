import type { EmployeeWithUser } from '@sawaa/shared';
import type { PractitionerBookingOptions, PublicBranch } from './booking.api';

export function todayLocalIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * The visible flow order depends on where the user entered:
 *
 *  - SERVICE entry (no params, or ?serviceId=…): Service → Therapist → Branch? → Time → Info
 *  - THERAPIST entry (?employeeId=…):              Therapist → Branch? → Service → Time → Info
 *
 * The underlying state machine still always needs `service` set before
 * `employee`. We bridge by buffering whichever selection arrives first and
 * dispatching them in the canonical order once both are known.
 */
export type EntryPoint = 'service' | 'therapist';

export type WizardScreen = 'service' | 'therapist' | 'choice' | 'branch' | 'slot' | 'info';

export type UiState = {
  entryPoint: EntryPoint;
  /** True while the dedicated branch screen is shown. */
  awaitingBranch: boolean;
  /** Employee picked on this device but not yet dispatched to the state machine. */
  pendingEmployee: EmployeeWithUser | null;
  /** Employee carried over from a deep-link until a service is picked. */
  lockedEmployee: EmployeeWithUser | null;
  selectedBranch: PublicBranch | null;
  selectedDate: string;
  selectedChoice: { durationOptionId: string; deliveryType: 'IN_PERSON' | 'ONLINE' } | null;
  isSubmitting: boolean;
  submitError: string | null;
  redirectUrl: string | null;
  bookingId: string | null;
  /** Existing booking/invoice to use when payment initialization is retried. */
  paymentRecovery: { bookingId: string; invoiceId: string } | null;
  /** True once a booking completed without an online payment (no invoice). */
  confirmed: boolean;
  practitionerOptions: PractitionerBookingOptions | null;
  practitionerOptionsLoading: boolean;
  showingChoiceStep: boolean;
  /** Therapist-first only: true once the user has confirmed the therapist and advanced to service. */
  therapistStepDone: boolean;
};

export type UiAction =
  | { type: 'SET_ENTRY_POINT'; entryPoint: EntryPoint }
  | { type: 'LOCK_EMPLOYEE'; employee: EmployeeWithUser }
  | { type: 'CLEAR_LOCKED_EMPLOYEE' }
  | { type: 'START_BRANCH_PICK'; employee: EmployeeWithUser }
  | { type: 'OPEN_INITIAL_BRANCH_PICK' }
  | { type: 'PICK_BRANCH'; branch: PublicBranch }
  | { type: 'CANCEL_BRANCH_PICK' }
  | { type: 'SET_DATE'; date: string }
  | { type: 'SET_CHOICE'; choice: { durationOptionId: string; deliveryType: 'IN_PERSON' | 'ONLINE' } | null }
  | { type: 'SUBMIT_START' }
  | { type: 'SUBMIT_ERROR'; error: string }
  | { type: 'SUBMIT_DONE'; bookingId: string; redirectUrl: string }
  | { type: 'SUBMIT_CONFIRMED'; bookingId: string }
  | { type: 'SET_PAYMENT_RECOVERY'; bookingId: string; invoiceId: string }
  | { type: 'CLEAR_PAYMENT_RECOVERY' }
  | { type: 'CLEAR_COMPLETION' }
  | { type: 'SET_PRACTITIONER_OPTIONS'; opts: PractitionerBookingOptions | null }
  | { type: 'SET_PRACTITIONER_OPTIONS_LOADING'; loading: boolean }
  | { type: 'ENTER_CHOICE_STEP' }
  | { type: 'EXIT_CHOICE_STEP' }
  | { type: 'THERAPIST_STEP_DONE' }
  | { type: 'THERAPIST_STEP_UNDONE' };

export const INITIAL_UI_STATE: UiState = {
  entryPoint: 'service',
  awaitingBranch: false,
  pendingEmployee: null,
  lockedEmployee: null,
  selectedBranch: null,
  selectedDate: todayLocalIso(),
  selectedChoice: null,
  isSubmitting: false,
  submitError: null,
  redirectUrl: null,
  bookingId: null,
  paymentRecovery: null,
  confirmed: false,
  practitionerOptions: null,
  practitionerOptionsLoading: false,
  showingChoiceStep: false,
  therapistStepDone: false,
};

export function uiReducer(state: UiState, action: UiAction): UiState {
  switch (action.type) {
    case 'SET_ENTRY_POINT':
      return { ...state, entryPoint: action.entryPoint };
    case 'LOCK_EMPLOYEE':
      return { ...state, lockedEmployee: action.employee, therapistStepDone: false };
    case 'CLEAR_LOCKED_EMPLOYEE':
      return { ...state, lockedEmployee: null };
    case 'START_BRANCH_PICK':
      return { ...state, awaitingBranch: true, pendingEmployee: action.employee };
    case 'OPEN_INITIAL_BRANCH_PICK':
      return { ...state, awaitingBranch: true, pendingEmployee: null };
    case 'PICK_BRANCH':
      return { ...state, selectedBranch: action.branch, awaitingBranch: false };
    case 'CANCEL_BRANCH_PICK':
      return { ...state, awaitingBranch: false, pendingEmployee: null };
    case 'SET_DATE':
      return { ...state, selectedDate: action.date };
    case 'SET_CHOICE':
      return { ...state, selectedChoice: action.choice };
    case 'SUBMIT_START':
      return { ...state, isSubmitting: true, submitError: null };
    case 'SUBMIT_ERROR':
      return { ...state, isSubmitting: false, submitError: action.error };
    case 'SUBMIT_DONE':
      return {
        ...state,
        isSubmitting: false,
        bookingId: action.bookingId,
        redirectUrl: action.redirectUrl,
        paymentRecovery: null,
      };
    case 'SUBMIT_CONFIRMED':
      return {
        ...state,
        isSubmitting: false,
        bookingId: action.bookingId,
        confirmed: true,
        paymentRecovery: null,
      };
    case 'SET_PAYMENT_RECOVERY':
      return {
        ...state,
        bookingId: action.bookingId,
        paymentRecovery: { bookingId: action.bookingId, invoiceId: action.invoiceId },
      };
    case 'CLEAR_PAYMENT_RECOVERY':
      return {
        ...state,
        paymentRecovery: null,
        bookingId: null,
        submitError: null,
      };
    case 'CLEAR_COMPLETION':
      return {
        ...state,
        confirmed: false,
        bookingId: null,
        redirectUrl: null,
      };
    case 'SET_PRACTITIONER_OPTIONS':
      return { ...state, practitionerOptions: action.opts };
    case 'SET_PRACTITIONER_OPTIONS_LOADING':
      return { ...state, practitionerOptionsLoading: action.loading };
    case 'ENTER_CHOICE_STEP':
      return { ...state, showingChoiceStep: true };
    case 'EXIT_CHOICE_STEP':
      return { ...state, showingChoiceStep: false };
    case 'THERAPIST_STEP_DONE':
      return { ...state, therapistStepDone: true };
    case 'THERAPIST_STEP_UNDONE':
      return { ...state, therapistStepDone: false };
    default:
      return state;
  }
}

/**
 * Compute the screen sequence shown in the stepper for a given entry point.
 * Branch is never a numbered step — the main branch is auto-selected on load
 * and the user can change it via the affordance without it counting as a step.
 */
export function buildFlow(entryPoint: EntryPoint): WizardScreen[] {
  if (entryPoint === 'therapist') {
    return ['therapist', 'service', 'choice', 'slot', 'info'];
  }
  return ['service', 'therapist', 'choice', 'slot', 'info'];
}
