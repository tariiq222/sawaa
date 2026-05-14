import type { AvailableSlot, GuestClientInfo } from '../types/guest';
import type { Service } from '../types/service';
import type { EmployeeWithUser } from '../types/employee';

export enum WizardStep {
  SERVICE = 'SERVICE',
  THERAPIST = 'THERAPIST',
  SLOT = 'SLOT',
  INFO_OTP = 'INFO_OTP',
  PAYMENT = 'PAYMENT',
  CONFIRMATION = 'CONFIRMATION',
}

export interface ServiceSelection {
  service: Service;
}

export interface TherapistSelection {
  employee: EmployeeWithUser;
}

export interface SlotSelection {
  slot: AvailableSlot;
}

export interface ClientInfo {
  client: GuestClientInfo;
  sessionToken: string | null;
}

export interface PaymentReady {
  bookingId: string;
  invoiceId: string;
  totalHalalat: number;
  redirectUrl: string;
}

export interface ConfirmationData {
  bookingId: string;
  status: 'success' | 'failed';
}

export type WizardState =
  | { step: WizardStep.SERVICE }
  | { step: WizardStep.THERAPIST; service: Service }
  | { step: WizardStep.SLOT; service: Service; employee: EmployeeWithUser }
  | { step: WizardStep.INFO_OTP; service: Service; employee: EmployeeWithUser; slot: AvailableSlot }
  | { step: WizardStep.PAYMENT; service: Service; employee: EmployeeWithUser; slot: AvailableSlot; client: GuestClientInfo }
  | { step: WizardStep.CONFIRMATION; bookingId: string; status: 'success' | 'failed' };

export type WizardEvent =
  | { type: 'SELECT_SERVICE'; service: Service }
  | { type: 'SELECT_EMPLOYEE'; employee: EmployeeWithUser }
  | { type: 'SELECT_SLOT'; slot: AvailableSlot }
  | { type: 'SUBMIT_INFO'; client: GuestClientInfo }
  | { type: 'VERIFY_OTP'; sessionToken: string }
  | { type: 'INIT_PAYMENT'; bookingId: string; invoiceId: string; totalHalalat: number; redirectUrl: string }
  | { type: 'PAYMENT_SUCCESS'; bookingId: string }
  | { type: 'PAYMENT_FAIL' }
  | { type: 'RESET' };

export function reduce(state: WizardState, event: WizardEvent): WizardState {
  switch (state.step) {
    case WizardStep.SERVICE:
      if (event.type === 'SELECT_SERVICE') {
        return { step: WizardStep.THERAPIST, service: event.service };
      }
      break;

    case WizardStep.THERAPIST:
      if (event.type === 'SELECT_EMPLOYEE') {
        return { step: WizardStep.SLOT, service: state.service, employee: event.employee };
      }
      if (event.type === 'SELECT_SERVICE') {
        return { step: WizardStep.THERAPIST, service: event.service };
      }
      break;

    case WizardStep.SLOT:
      if (event.type === 'SELECT_SLOT') {
        return {
          step: WizardStep.INFO_OTP,
          service: state.service,
          employee: state.employee,
          slot: event.slot,
        };
      }
      if (event.type === 'SELECT_SERVICE') {
        return { step: WizardStep.THERAPIST, service: event.service };
      }
      if (event.type === 'SELECT_EMPLOYEE') {
        return { step: WizardStep.SLOT, service: state.service, employee: event.employee };
      }
      break;

    case WizardStep.INFO_OTP:
      if (event.type === 'SUBMIT_INFO') {
        return {
          step: WizardStep.PAYMENT,
          service: state.service,
          employee: state.employee,
          slot: state.slot,
          client: event.client,
        };
      }
      if (event.type === 'SELECT_SERVICE') {
        return { step: WizardStep.THERAPIST, service: event.service };
      }
      if (event.type === 'SELECT_EMPLOYEE') {
        return { step: WizardStep.SLOT, service: state.service, employee: event.employee };
      }
      if (event.type === 'SELECT_SLOT') {
        return {
          step: WizardStep.INFO_OTP,
          service: state.service,
          employee: state.employee,
          slot: event.slot,
        };
      }
      break;

    case WizardStep.PAYMENT:
      if (event.type === 'INIT_PAYMENT') {
        return {
          step: WizardStep.CONFIRMATION,
          bookingId: event.bookingId,
          status: 'success',
        };
      }
      if (event.type === 'PAYMENT_SUCCESS') {
        return { step: WizardStep.CONFIRMATION, bookingId: event.bookingId, status: 'success' };
      }
      if (event.type === 'PAYMENT_FAIL') {
        return { step: WizardStep.CONFIRMATION, bookingId: '', status: 'failed' };
      }
      if (event.type === 'SELECT_SERVICE') {
        return { step: WizardStep.THERAPIST, service: event.service };
      }
      if (event.type === 'SELECT_EMPLOYEE') {
        return { step: WizardStep.SLOT, service: state.service, employee: event.employee };
      }
      if (event.type === 'SELECT_SLOT') {
        return {
          step: WizardStep.INFO_OTP,
          service: state.service,
          employee: state.employee,
          slot: event.slot,
        };
      }
      break;

    case WizardStep.CONFIRMATION:
      if (event.type === 'RESET') {
        return { step: WizardStep.SERVICE };
      }
      break;
  }

  return state;
}

export const INITIAL_WIZARD_STATE: WizardState = { step: WizardStep.SERVICE };