import { buildStaffCancellationIntent } from './staff-cancellation-refund';
const payment = (id: string, overrides = {}) => ({ id, invoiceId: 'i1', status: 'COMPLETED', amount: 10000, refundedAmount: 0, currency: 'SAR', method: 'ONLINE_CARD', gatewayRef: 'gw', refundRequests: [], ...overrides });
const input = { currency: 'SAR', initiatedBy: 'CENTER' as const, reason: 'Program Group cancelled', performedBy: 'employee', automatic: true };
describe('staff cancellation money intent', () => {
  it('allocates all captured funds deterministically while subtracting existing claims', () => {
    const intent = buildStaffCancellationIntent({ ...input, payments: [payment('p2', { method: 'CASH' }), payment('p1', { refundedAmount: 2000, refundRequests: [{ id: 'r1', status: 'PROCESSING', amount: 1000 }] }), payment('pending', { status: 'PENDING' })] });
    expect(intent.refund).toMatchObject({ paidAmount: 20000, alreadyRefundedAmount: 2000, pendingRefundAmount: 1000, refundAmount: 17000 });
    expect(intent.allocations.map(a => [a.paymentId, a.amount, a.execution])).toEqual([['p1', 7000, 'REVIEW'], ['p2', 10000, 'REVIEW']]);
  });
  it('accepts explicit additional amount and zero; rejects fractional, excessive and mixed currency amounts', () => {
    expect(buildStaffCancellationIntent({ ...input, payments: [payment('p1')], refundAmount: 1234 }).allocations[0]).toMatchObject({ amount: 1234, execution: 'AUTOMATIC' });
    expect(buildStaffCancellationIntent({ ...input, payments: [payment('p1')], refundAmount: 0 }).allocations).toEqual([]);
    for (const refundAmount of [-1, 1.5, 10001]) expect(() => buildStaffCancellationIntent({ ...input, payments: [payment('p1')], refundAmount })).toThrow();
    expect(() => buildStaffCancellationIntent({ ...input, payments: [payment('p1', { currency: 'USD' })] })).toThrow();
  });
});
