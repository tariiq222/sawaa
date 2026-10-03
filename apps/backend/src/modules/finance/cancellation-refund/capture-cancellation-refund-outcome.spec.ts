import { captureCancellationRefundOutcome } from './capture-cancellation-refund-outcome';
import { stableEventId } from '../../../common/events';

const cancellationEventId = '22222222-2222-4222-8222-222222222222';
function setup() {
  const request = { id: 'r1', sourceEventId: stableEventId(`${cancellationEventId}:payment:p1`), paymentId: 'p1', status: 'DENIED', amount: 5000, clientId: 'c1', invoice: { bookingId: 'b1' } };
  const intent = { version: 1, initiatedBy: 'CLIENT', allocations: [{ paymentId: 'p1' }] };
  const tx = {
    refundRequest: { findUniqueOrThrow: jest.fn(async () => request) },
    bookingStatusLog: { findFirst: jest.fn().mockResolvedValue({ sourceActionResult: { cancellationEventId } }) },
    outboxEvent: { findMany: jest.fn().mockResolvedValue([]), findUnique: jest.fn().mockResolvedValue({ payload: { payload: { clientCancellation: intent } } }), upsert: jest.fn() },
  };
  return { tx, request, intent };
}

describe('persisted cancellation refund outcome producer', () => {
  it.each(['DENIED', 'FAILED', 'MANUAL_REVIEW'])('captures persisted %s once per request/status identity', async status => {
    const { tx, request } = setup();
    request.status = status;
    await captureCancellationRefundOutcome(tx as never, request.id);
    await captureCancellationRefundOutcome(tx as never, request.id);
    const expectedId = stableEventId(`${cancellationEventId}:refund:r1:${status}`);
    expect(tx.outboxEvent.upsert.mock.calls.map(([call]) => call.where.id)).toEqual([expectedId, expectedId]);
    expect(tx.outboxEvent.upsert).toHaveBeenLastCalledWith({ where: { id: expectedId }, update: {}, create: expect.objectContaining({
      payload: expect.objectContaining({ payload: { bookingId: 'b1', clientId: 'c1', refundRequestId: 'r1', status, amount: 5000 } }),
    }) });
  });
  it.each(['PROCESSING', 'APPROVED', 'COMPLETED'])('does not announce %s through the noncompletion outcome hook', async status => {
    const { tx, request } = setup();
    request.status = status;
    await captureCancellationRefundOutcome(tx as never, request.id);
    expect(tx.outboxEvent.upsert).not.toHaveBeenCalled();
  });
  it('ignores unrelated source identities and invalid allocations', async () => {
    const { tx, request, intent } = setup();
    request.sourceEventId = 'unrelated-event';
    await captureCancellationRefundOutcome(tx as never, request.id);
    request.sourceEventId = stableEventId(`${cancellationEventId}:payment:p1`);
    intent.initiatedBy = 'UNKNOWN';
    await captureCancellationRefundOutcome(tx as never, request.id);
    intent.initiatedBy = 'CLIENT';
    intent.allocations = [{ paymentId: 'p2' }];
    await captureCancellationRefundOutcome(tx as never, request.id);
    tx.bookingStatusLog.findFirst.mockResolvedValue(null);
    await captureCancellationRefundOutcome(tx as never, request.id);
    expect(tx.outboxEvent.upsert).not.toHaveBeenCalled();
  });
  it('fails the enclosing transaction when durable capture cannot persist', async () => {
    const { tx, request } = setup();
    tx.outboxEvent.upsert.mockRejectedValue(new Error('outbox unavailable'));
    await expect(captureCancellationRefundOutcome(tx as never, request.id)).rejects.toThrow('outbox unavailable');
  });
});

describe('retained terminal participant refund outcome', () => {
  it.each(['DENIED', 'FAILED', 'MANUAL_REVIEW'])('finds CENTER %s from exact financial source when no cancelled status log exists', async status => {
    const { tx, request } = setup();
    request.status = status;
    tx.bookingStatusLog.findFirst.mockResolvedValue(null);
    const centerCancellation = { version: 1, initiatedBy: 'CENTER', allocations: [{ paymentId: 'p1' }] };
    (tx.outboxEvent as any).findMany = jest.fn().mockResolvedValue([{ id: cancellationEventId, payload: { payload: { centerCancellation } } }]);
    await captureCancellationRefundOutcome(tx as never, request.id);
    await captureCancellationRefundOutcome(tx as never, request.id);
    const id = stableEventId(`${cancellationEventId}:refund:r1:${status}`);
    expect(tx.outboxEvent.upsert.mock.calls.map(([call]) => call.where.id)).toEqual([id, id]);
    expect(tx.outboxEvent.upsert).toHaveBeenLastCalledWith(expect.objectContaining({ create: expect.objectContaining({ payload: expect.objectContaining({ payload: expect.objectContaining({ refundRequestId: 'r1' }) }) }) }));
  });
});
