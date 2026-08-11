import { describe, it, expect } from 'vitest';
import { resolveBookingSubmitOutcome } from './booking-submit-outcome';

describe('resolveBookingSubmitOutcome', () => {
  it('routes to the payment path when an invoice is present', () => {
    expect(
      resolveBookingSubmitOutcome({ invoiceId: 'inv_1', status: 'AWAITING_PAYMENT' }),
    ).toEqual({ kind: 'payment', invoiceId: 'inv_1' });
  });

  it('routes to the payment path when an invoice is present regardless of status', () => {
    expect(resolveBookingSubmitOutcome({ invoiceId: 'inv_1', status: 'CONFIRMED' })).toEqual({
      kind: 'payment',
      invoiceId: 'inv_1',
    });
  });

  it('treats a missing invoice with status CONFIRMED as success', () => {
    expect(resolveBookingSubmitOutcome({ invoiceId: null, status: 'CONFIRMED' })).toEqual({
      kind: 'success',
    });
  });

  it('treats a missing invoice with status DEPOSIT_PAID as success', () => {
    expect(resolveBookingSubmitOutcome({ invoiceId: null, status: 'DEPOSIT_PAID' })).toEqual({
      kind: 'success',
    });
  });

  it('fails safely when the invoice is missing but the status is AWAITING_PAYMENT', () => {
    expect(resolveBookingSubmitOutcome({ invoiceId: null, status: 'AWAITING_PAYMENT' })).toEqual({
      kind: 'failure',
    });
  });

  it('fails safely on unknown or non-success statuses with a missing invoice', () => {
    expect(resolveBookingSubmitOutcome({ invoiceId: null, status: 'PENDING' })).toEqual({
      kind: 'failure',
    });
    expect(resolveBookingSubmitOutcome({ invoiceId: null, status: 'CANCELLED' })).toEqual({
      kind: 'failure',
    });
    expect(resolveBookingSubmitOutcome({ invoiceId: null, status: 'WHATEVER' })).toEqual({
      kind: 'failure',
    });
  });

  it('fails safely when the status is missing entirely with a missing invoice', () => {
    expect(resolveBookingSubmitOutcome({ invoiceId: null })).toEqual({ kind: 'failure' });
  });
});
