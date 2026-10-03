import { calculateClientCancellation, type ClientCancellationSettings } from './client-cancellation-policy';

const now = new Date('2026-10-03T10:00:00Z');
const booking = { id: 'b1', clientId: 'c1', status: 'DEPOSIT_PAID', bookingType: 'INDIVIDUAL', scheduledAt: new Date('2026-10-03T12:00:00Z'), endsAt: new Date('2026-10-03T13:00:00Z'), checkedInAt: null, isHistoricalImport: false, packageCreditId: null, currency: 'SAR' };
const settings: ClientCancellationSettings = { clientCancellationPolicyEnabled: true, clientCancelCutoffMode: 'BEFORE_START', clientCancelBeforeHours: 0, earlyCancelRefundPercent: 60, freeCancelBeforeHours: 1, freeCancelRefundType: 'PARTIAL', lateCancelRefundPercent: 25, autoRefundOnCancel: true };
const payment = { id: 'p1', invoiceId: 'i1', amount: 10000, refundedAmount: 0, status: 'COMPLETED', method: 'ONLINE_CARD', gatewayRef: 'gateway-1', currency: 'SAR', refundRequests: [] };
const calc = (overrides = {}, payments = [payment], policy = settings, at = now) => calculateClientCancellation({ ...booking, ...overrides }, policy, payments, at);

describe('client cancellation policy', () => {
  it('accepts zero-hour cutoff including exactly the start, rejects after it', () => {
    expect(calc({}, [], settings, booking.scheduledAt).canCancel).toBe(true);
    expect(calc({}, [], settings, new Date(booking.scheduledAt.getTime() + 1)).reasonCode).toBe('CUTOFF_PASSED');
  });
  it('separates late refund tier from cancellation eligibility', () => {
    const quote = calc({}, [payment], settings, new Date('2026-10-03T11:30:00Z'));
    expect(quote.canCancel).toBe(true);
    expect(quote.refund).toMatchObject({ refundAmount: 2500, refundPercent: 25, window: 'LATE', status: 'PROCESSING' });
  });
  it.each(['COMPLETED', 'CANCELLED', 'EXPIRED', 'NO_SHOW', 'CANCEL_REQUESTED'])('does not self-cancel %s', status => expect(calc({ status }).reasonCode).toBe('FINAL_STATE'));
  it.each([
    [{ checkedInAt: now }, 'ATTENDED'], [{ isHistoricalImport: true }, 'HISTORICAL'], [{ bookingType: 'GROUP' }, 'GROUP_STAFF_ONLY'],
  ])('rejects unavailable booking %p', (overrides, code) => expect(calc(overrides).reasonCode).toBe(code));
  it('before-check-in stops strictly at end even without attendance', () => {
    const policy = { ...settings, clientCancelCutoffMode: 'BEFORE_CHECK_IN' as const, clientCancelBeforeHours: null };
    expect(calc({}, [], policy, new Date('2026-10-03T12:30:00Z')).canCancel).toBe(true);
    expect(calc({}, [], policy, booking.endsAt).reasonCode).toBe('CUTOFF_PASSED');
  });
  it('fails closed when policy config is incomplete, preserving disabled status', () => {
    expect(calc({}, [], { ...settings, earlyCancelRefundPercent: null }).reasonCode).toBe('POLICY_NOT_CONFIGURED');
    expect(calc({}, [], { ...settings, clientCancellationPolicyEnabled: false }).policyEnabled).toBe(false);
  });
  it('uses total original captured payments and subtracts refunds and reservations', () => {
    const quote = calc({}, [{ ...payment, amount: 10000, refundedAmount: 1000, refundRequests: [{ id: 'r1', amount: 2000, status: 'PENDING_REVIEW' }] }, { ...payment, id: 'p2', amount: 5000 }] as never);
    expect(quote.refund).toMatchObject({ paidAmount: 15000, alreadyRefundedAmount: 1000, pendingRefundAmount: 2000, refundAmount: 6000, refundPercent: 60 });
    expect(quote.allocations.reduce((n, p) => n + p.amount, 0)).toBe(6000);
  });
  it('makes cash/manual and prior gateway refunds review-only without inventing settlement', () => {
    expect(calc({}, [{ ...payment, method: 'CASH', gatewayRef: null }] as never).refund).toMatchObject({ status: 'PENDING_REVIEW', execution: 'REVIEW' });
    expect(calc({}, [{ ...payment, refundedAmount: 1000 }]).refund.execution).toBe('REVIEW');
    expect(calc({}, [payment], { ...settings, autoRefundOnCancel: false }).refund.execution).toBe('REVIEW');
  });
  it('distinguishes unpaid, no entitlement and package credit', () => {
    expect(calc({}, []).refund.status).toBe('NOT_APPLICABLE');
    expect(calc({}, [payment], { ...settings, freeCancelRefundType: 'NONE' }).refund.status).toBe('NO_REFUND');
    expect(calc({ packageCreditId: 'credit' }).refund).toMatchObject({ status: 'CREDIT_RETURNED', refundAmount: 0, execution: 'NONE' });
  });
  it('fingerprints payment/policy changes but not clock ticks within the same tier', () => {
    expect(calc().quoteToken).toBe(calc({}, [payment], settings, new Date(now.getTime() + 1000)).quoteToken);
    expect(calc().quoteToken).not.toBe(calc({}, [{ ...payment, amount: 12000 }]).quoteToken);
    expect(calc().quoteToken).not.toBe(calc({}, [payment], { ...settings, earlyCancelRefundPercent: 50 }).quoteToken);
  });
});
