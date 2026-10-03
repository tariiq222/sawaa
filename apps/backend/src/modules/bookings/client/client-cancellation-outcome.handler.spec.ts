import { ClientCancellationOutcomeHandler } from './client-cancellation-outcome.handler';
import { stableEventId } from '../../../common/events';

describe('persisted cancellation refund outcome', () => {
  const original = { status: 'PROCESSING', refundAmount: 5000, pendingRefundAmount: 0, alreadyRefundedAmount: 1000, paidAmount: 10000, currency: 'SAR', execution: 'AUTOMATIC', window: 'EARLY', refundPercent: 60 };
  function setup(status: string, refunded: number) {
    const db = {
      booking: { findFirst: jest.fn().mockResolvedValue({ id: 'b1' }) },
      bookingStatusLog: { findFirst: jest.fn().mockResolvedValue({ sourceActionResult: { refund: original, cancellationEventId: 'event-1' } }) },
      outboxEvent: { findUnique: jest.fn().mockResolvedValue({ payload: { payload: { clientCancellation: { allocations: [{ paymentId: 'p1' }] } } } }) },
      payment: { findMany: jest.fn().mockResolvedValue([{ refundedAmount: refunded, refundRequests: [{ id: 'r1', sourceEventId: stableEventId('event-1:payment:p1'), status, amount: 5000 }] }]) },
    };
    return new ClientCancellationOutcomeHandler(db as never);
  }
  it('uses the persisted quote and only declares completion from confirmed refunded balance', async () => {
    expect(await setup('COMPLETED', 6000).execute('b1', 'c1')).toMatchObject({ refundAmount: 5000, status: 'COMPLETED', completedAmount: 5000, failedAmount: 0 });
    expect(await setup('PROCESSING', 1000).execute('b1', 'c1')).toMatchObject({ status: 'PROCESSING', completedAmount: 0, pendingRefundAmount: 5000 });
  });
  it('exposes failed/review requests without claiming money movement', async () => {
    expect(await setup('FAILED', 1000).execute('b1', 'c1')).toMatchObject({ status: 'FAILED', failedAmount: 5000, completedAmount: 0 });
    expect(await setup('MANUAL_REVIEW', 1000).execute('b1', 'c1')).toMatchObject({ status: 'PENDING_REVIEW', completedAmount: 0 });
  });
});
