import { CancellationRefundIntentService } from './cancellation-refund-intent.service';
import { stableEventId } from '../../../common/events';

const eventId = '11111111-1111-4111-8111-111111111111';
const intent = { version: 1, initiatedBy: 'CLIENT', refund: { refundAmount: 5000, alreadyRefundedAmount: 0, pendingRefundAmount: 0 }, allocations: [{ paymentId: 'p1', invoiceId: 'i1', amount: 5000, execution: 'AUTOMATIC', baselineRefundedAmount: 0, baselinePendingAmount: 0 }] } as any;
function setup() {
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([]),
    payment: { findMany: jest.fn(), findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'p1', invoiceId: 'i1', status: 'COMPLETED', amount: 10000, refundedAmount: 0, method: 'ONLINE_CARD', gatewayRef: 'g1', refundRequests: [] }) },
    refundRequest: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn(async ({ data }) => data), findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'r1', status: 'PROCESSING', amount: 5000 }) },
    outboxEvent: { upsert: jest.fn() },
  };
  tx.payment.findMany.mockImplementation(async () => [await tx.payment.findUniqueOrThrow()]);
  const refunds = { createRefundRequestInTx: jest.fn().mockResolvedValue({ refundRequestId: 'r1', idempotencyKey: 'refund:r1' }), finalizeRefundFromCancellation: jest.fn() };
  const rls = { withTransaction: jest.fn(fn => fn(tx)) };
  const service = new CancellationRefundIntentService(rls as never, refunds as never);
  return { tx, refunds, service };
}
describe('durable cancellation refund intents', () => {
  it('uses the existing gateway owner after committing an idempotent request', async () => {
    const { service, refunds } = setup();
    await service.execute(eventId, 'b1', 'c1', intent);
    expect(refunds.createRefundRequestInTx).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ paymentId: 'p1', amount: 5000, sourceEventId: stableEventId(`${eventId}:payment:p1`) }));
    expect(refunds.finalizeRefundFromCancellation).toHaveBeenCalledWith({ refundRequestId: 'r1', idempotencyKey: 'refund:r1', sourceEventId: stableEventId(`${eventId}:payment:p1`) });
  });
  it('never treats cash as completed money movement', async () => {
    const { service, tx, refunds } = setup();
    tx.payment.findUniqueOrThrow.mockResolvedValue({ id: 'p1', invoiceId: 'i1', status: 'COMPLETED', amount: 10000, refundedAmount: 0, method: 'CASH', gatewayRef: null, refundRequests: [] } as never);
    await service.execute(eventId, 'b1', 'c1', intent);
    expect(tx.refundRequest.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'PENDING_REVIEW', amount: 5000 }) }));
    expect(refunds.createRefundRequestInTx).not.toHaveBeenCalled();
    expect(refunds.finalizeRefundFromCancellation).not.toHaveBeenCalled();
  });
  it('clamps new reservations and already-refunded amounts under locks', async () => {
    const { service, tx, refunds } = setup();
    tx.payment.findUniqueOrThrow.mockResolvedValue({ id: 'p1', invoiceId: 'i1', status: 'PARTIALLY_REFUNDED', amount: 10000, refundedAmount: 1000, method: 'ONLINE_CARD', gatewayRef: 'g1', refundRequests: [{ amount: 2000, status: 'PROCESSING' }] } as never);
    await service.execute(eventId, 'b1', 'c1', intent);
    expect(tx.refundRequest.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'PENDING_REVIEW', amount: 2000 }) }));
    expect(refunds.finalizeRefundFromCancellation).not.toHaveBeenCalled();
  });
  it('replays the existing request without creating another', async () => {
    const { service, tx, refunds } = setup();
    tx.refundRequest.findUnique.mockResolvedValue({ id: 'r1', status: 'PROCESSING', idempotencyKey: 'refund:r1' } as never);
    await service.execute(eventId, 'b1', 'c1', intent);
    expect(tx.refundRequest.create).not.toHaveBeenCalled();
    expect(refunds.createRefundRequestInTx).not.toHaveBeenCalled();
    expect(refunds.finalizeRefundFromCancellation).toHaveBeenCalledTimes(1);
  });
  it('continues other payments after one provider fails, then rejects for durable retry', async () => {
    const { service, tx, refunds } = setup();
    tx.payment.findMany.mockImplementation(async () => [await tx.payment.findUniqueOrThrow(), { ...(await tx.payment.findUniqueOrThrow()), id: 'p2' }]);
    refunds.finalizeRefundFromCancellation.mockRejectedValueOnce(new Error('gateway down'));
    await expect(service.execute(eventId, 'b1', 'c1', { ...intent, refund: { ...intent.refund, refundAmount: 10000 }, allocations: [...intent.allocations, { ...intent.allocations[0], paymentId: 'p2' }] })).rejects.toThrow('gateway down');
    expect(refunds.finalizeRefundFromCancellation).toHaveBeenCalledTimes(2);
  });
});


describe('booking-wide frozen cancellation entitlement', () => {
  const payment = (id: string, overrides = {}) => ({ id, invoiceId: 'i1', status: 'COMPLETED', amount: 10000, refundedAmount: 0, method: 'CASH', gatewayRef: null, refundRequests: [] as any[], ...overrides });
  const frozen = { ...intent, refund: { refundAmount: 10000, alreadyRefundedAmount: 0, pendingRefundAmount: 0 }, allocations: [{ ...intent.allocations[0], amount: 10000 }] };

  it.each(['COMPLETED', 'PENDING_REVIEW', 'PROCESSING', 'MANUAL_REVIEW'])('does not add a refund when another capture has a new %s claim consuming the entitlement', async status => {
    const { service, tx, refunds } = setup();
    const first = payment('p1');
    const other = payment('p2', status === 'COMPLETED'
      ? { status: 'REFUNDED', refundedAmount: 10000, refundRequests: [{ id: 'other', status, amount: 10000 }] }
      : { refundRequests: [{ id: 'other', status, amount: 10000 }] });
    tx.payment.findUniqueOrThrow.mockResolvedValue(first as never);
    tx.payment.findMany.mockResolvedValue([first, other]);
    await service.execute(eventId, 'b1', 'c1', frozen);
    expect(tx.refundRequest.create).not.toHaveBeenCalled();
    expect(refunds.createRefundRequestInTx).not.toHaveBeenCalled();
  });

  it('limits a partial competing claim on a different capture using the aggregate baseline', async () => {
    const { service, tx } = setup();
    const first = payment('p1');
    tx.payment.findUniqueOrThrow.mockResolvedValue(first as never);
    tx.payment.findMany.mockResolvedValue([first, payment('p2', { refundedAmount: 3000, refundRequests: [{ id: 'other', status: 'APPROVED', amount: 4000 }] })]);
    await service.execute(eventId, 'b1', 'c1', { ...frozen, refund: { ...frozen.refund, alreadyRefundedAmount: 2000, pendingRefundAmount: 1000 } });
    expect(tx.refundRequest.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ paymentId: 'p1', amount: 6000 }) }));
  });

  it.each(['PENDING_REVIEW', 'COMPLETED'])('counts a prior own %s allocation once, clamps later allocation and safely replays', async status => {
    const { service, tx } = setup();
    const prior = { id: 'own1', paymentId: 'p1', sourceEventId: stableEventId(`${eventId}:payment:p1`), amount: 4000, status };
    const rows = [payment('p1', { refundedAmount: status === 'COMPLETED' ? 4000 : 0, refundRequests: [prior] }), payment('p2'), payment('p3', { refundRequests: [{ id: 'other', status: 'PROCESSING', amount: 3000 }] })];
    tx.payment.findMany.mockResolvedValue(rows);
    tx.payment.findUniqueOrThrow.mockImplementation(async ({ where }) => rows.find(p => p.id === where.id) as never);
    const requests = [prior];
    tx.refundRequest.findUnique.mockImplementation(async ({ where }) => requests.find(r => r.sourceEventId === where.sourceEventId) as never);
    tx.refundRequest.create.mockImplementation(async ({ data }) => { requests.push(data); rows[1].refundRequests.push(data); return data; });
    const split = { ...frozen, allocations: [{ ...frozen.allocations[0], amount: 4000 }, { ...frozen.allocations[0], paymentId: 'p2', amount: 6000 }] };
    await service.execute(eventId, 'b1', 'c1', split);
    await service.execute(eventId, 'b1', 'c1', split);
    expect(tx.refundRequest.create).toHaveBeenCalledTimes(1);
    expect(tx.refundRequest.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ paymentId: 'p2', amount: 3000 }) }));
  });

  it('does not grow frozen allocations when baseline reservations are released', async () => {
    const { service, tx } = setup();
    const first = payment('p1');
    tx.payment.findUniqueOrThrow.mockResolvedValue(first as never);
    tx.payment.findMany.mockResolvedValue([first, payment('p2')]);
    await service.execute(eventId, 'b1', 'c1', { ...frozen, refund: { ...frozen.refund, pendingRefundAmount: 5000 }, allocations: [{ ...frozen.allocations[0], amount: 4000 }] });
    expect(tx.refundRequest.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ amount: 4000 }) }));
  });
});


describe('staff financial audit attribution', () => {
  it('uses the frozen staff reason and actor for gateway work', async () => {
    const { service, refunds } = setup();
    await service.execute(eventId, 'b1', 'c1', { ...intent, initiatedBy: 'CENTER', reason: 'Program Group cancelled', performedBy: 'staff1' });
    expect(refunds.createRefundRequestInTx).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ reason: 'Program Group cancelled', performedBy: 'staff1' }));
  });
});
