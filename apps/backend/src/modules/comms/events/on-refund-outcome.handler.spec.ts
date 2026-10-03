import { OnRefundOutcomeHandler } from './on-refund-outcome.handler';
import { clientCancellationBody } from './client-cancellation-copy';

function setup(status = 'COMPLETED', captureEnabled = false) {
  const db = { refundRequest: { findUnique: jest.fn().mockResolvedValue({ id: 'r1', status, amount: 5000, clientId: 'c1', invoice: { bookingId: 'b1', currency: 'SAR' } }) } };
  const notify = { execute: jest.fn() };
  const capture = { execute: jest.fn().mockResolvedValue('intent') };
  const materialize = { execute: jest.fn() };
  const ownership = { execute: jest.fn().mockResolvedValue(null) };
  const handler = new OnRefundOutcomeHandler(db as never, notify as never, { execute: jest.fn().mockResolvedValue({ pushEnabled: true, tokens: ['token'] }) } as never, capture as never, materialize as never, ownership as never, { shouldCapture: () => captureEnabled } as never);
  return { handler, db, notify, capture, materialize, ownership };
}
const event = { version: 1, occurredAt: '2026-10-03T10:00:00Z', payload: { refundRequestId: 'r1' } } as any;
describe('truthful refund notifications', () => {
  it('rejects success events until the ledger confirms completion', async () => {
    const { handler, notify } = setup('PROCESSING');
    await expect(handler.handle(event, true)).rejects.toThrow('not confirmed');
    expect(notify.execute).not.toHaveBeenCalled();
  });
  it('uses stable notification identity on duplicate legacy success deliveries', async () => {
    const { handler, notify } = setup();
    await handler.handle(event, true); await handler.handle(event, true);
    expect(notify.execute.mock.calls[0][0]).toMatchObject({ type: 'GENERAL', body: 'تم استرداد 50.00 SAR بنجاح.', notificationId: expect.any(String) });
    expect(notify.execute.mock.calls[1][0].notificationId).toBe(notify.execute.mock.calls[0][0].notificationId);
  });
  it.each(['FAILED', 'DENIED', 'MANUAL_REVIEW'])('deduplicates replay identity from ledger %s without claiming a completed refund', async status => {
    const { handler, notify } = setup(status);
    await handler.handle(event, false);
    await handler.handle(event, false);
    expect(notify.execute.mock.calls[0][0].notificationId).toBe(notify.execute.mock.calls[1][0].notificationId);
    expect(notify.execute.mock.calls[0][0].metadata.refundStatus).toBe(status);
    expect(notify.execute.mock.calls[0][0].body).not.toContain('بنجاح');
  });
  it('materializes an owned outcome without recapturing or legacy sending', async () => {
    const { handler, notify, ownership, materialize, capture } = setup('COMPLETED', true);
    ownership.execute.mockResolvedValue('owned');
    await handler.handle(event, true);
    expect(materialize.execute).toHaveBeenCalledWith('owned');
    expect(capture.execute).not.toHaveBeenCalled(); expect(notify.execute).not.toHaveBeenCalled();
  });
  it('reports review and failure truthfully', async () => {
    const review = setup('PENDING_REVIEW');
    await review.handler.handle(event, false);
    expect(review.notify.execute.mock.calls[0][0].body).toContain('لم يكتمل');
    const failed = setup('FAILED', true);
    await failed.handler.handle(event, false);
    expect(failed.capture.execute).toHaveBeenCalledWith(expect.objectContaining({ payload: expect.objectContaining({ status: 'FAILED', amount: 5000 }) }));
  });
  it('keeps staff copy unchanged and describes client processing without claiming completion', () => {
    expect(clientCancellationBody()).toBe('نأسف، تم إلغاء موعدك.');
    expect(clientCancellationBody({ refund: { status: 'PROCESSING', refundAmount: 5000, pendingRefundAmount: 0, currency: 'SAR' } } as any)).toBe('تم إلغاء موعدك. استرداد 50.00 SAR قيد المعالجة.');
  });
});
