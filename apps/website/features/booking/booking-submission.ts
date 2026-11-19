'use client';

import type { AvailableSlot, Service, EmployeeWithUser } from '@sawaa/shared';
import { createBooking, initPayment } from '@/features/booking/booking.api';
import { resolveBookingSubmitOutcome } from '@/features/booking/booking-submit-outcome';
import type { UiAction, UiState } from '@/features/booking/booking-wizard-state';

/**
 * Submit orchestration: builds the booking payload, calls the API, and maps
 * the result onto UI actions. This module performs I/O but owns no React
 * state — the composition hook supplies the dispatcher and translated
 * fallback messages.
 */

export type BookingPaymentRecovery = NonNullable<UiState['paymentRecovery']>;

export type SubmitBookingInput = {
  effectiveBranchId: string | undefined;
  service: Service | null;
  employee: EmployeeWithUser | null;
  slot: AvailableSlot | null;
  selectedChoice: UiState['selectedChoice'];
  paymentRecovery: BookingPaymentRecovery | null;
  payAtClinic: boolean;
  t: (key: 'booking.errors.missingBranch' | 'common.bookingFailed') => string;
};

function send(dispatch: (action: UiAction) => void, action: UiAction) {
  dispatch(action);
}

export async function submitBooking(
  input: SubmitBookingInput,
  dispatch: (action: UiAction) => void,
): Promise<void> {
  send(dispatch, { type: 'SUBMIT_START' });
  try {
    if (!input.effectiveBranchId) {
      send(dispatch, { type: 'SUBMIT_ERROR', error: input.t('booking.errors.missingBranch') });
      return;
    }
    if (!input.service || !input.employee || !input.slot) {
      send(dispatch, { type: 'SUBMIT_ERROR', error: input.t('common.bookingFailed') });
      return;
    }
    const recovered = input.paymentRecovery;
    const booking = recovered
      ? {
          id: recovered.bookingId,
          status: 'AWAITING_PAYMENT',
          invoiceId: recovered.invoiceId,
        }
      : await createBooking({
          serviceId: input.service.id,
          employeeId: input.employee.id,
          branchId: input.effectiveBranchId,
          scheduledAt: input.slot.startTime,
          durationOptionId: input.selectedChoice?.durationOptionId,
          deliveryType: input.selectedChoice?.deliveryType,
          payAtClinic: input.payAtClinic,
        });
    const outcome = resolveBookingSubmitOutcome(booking);
    if (outcome.kind === 'failure') {
      send(dispatch, { type: 'SUBMIT_ERROR', error: input.t('common.bookingFailed') });
      return;
    }
    if (outcome.kind === 'payment') {
      send(dispatch, {
        type: 'SET_PAYMENT_RECOVERY',
        bookingId: booking.id,
        invoiceId: outcome.invoiceId,
      });
      const payment = await initPayment(outcome.invoiceId);
      send(dispatch, {
        type: 'SUBMIT_DONE',
        bookingId: booking.id,
        redirectUrl: payment.redirectUrl,
      });
      return;
    }
    send(dispatch, { type: 'SUBMIT_CONFIRMED', bookingId: booking.id });
  } catch (err) {
    send(dispatch, {
      type: 'SUBMIT_ERROR',
      error: err instanceof Error ? err.message : input.t('common.bookingFailed'),
    });
  }
}
