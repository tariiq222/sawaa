import { ApproveCancelBookingHandler } from './approve-cancel-booking.handler';
import { buildPrisma, buildRlsTransaction, buildEventBus, mockBooking } from '../testing/booking-test-helpers';

function fixture() {
  const p = buildPrisma();
  p.booking.findFirst.mockResolvedValue({ ...mockBooking, status: 'CANCEL_REQUESTED' });
  p.$queryRaw.mockResolvedValue([]);
  p.invoice.findMany.mockResolvedValue([{ id: 'inv-1', currency: 'SAR' }]);
  const payments = [
    { id: 'pay-a', invoiceId: 'inv-1', amount: 10000, refundedAmount: 2000, currency: 'SAR', status: 'PARTIALLY_REFUNDED', method: 'CASH', gatewayRef: null, refundRequests: [] },
    { id: 'pay-b', invoiceId: 'inv-1', amount: 20000, refundedAmount: 0, currency: 'SAR', status: 'COMPLETED', method: 'ONLINE_CARD', gatewayRef: 'gateway', refundRequests: [] },
  ];
  Object.assign(p.payment, { findMany: jest.fn().mockResolvedValue(payments) });
  const refund = { createRefundRequestInTx: jest.fn() };
  const handler = new ApproveCancelBookingHandler(p as never, buildRlsTransaction(p) as never, buildEventBus() as never,
    { execute: jest.fn().mockResolvedValue({ autoRefundOnCancel: true }) } as never, {} as never, refund as never);
  return { p, refund, handler, intent: () => p.outboxEvent.create.mock.calls[0][0].data.payload.payload.staffCancellation };
}

describe('Legacy approval freezes staff refund intent', () => {
  it('captures all payments, keeps cash reviewable, and cancels before settlement', async () => {
    const f = fixture();
    await f.handler.execute({ bookingId: 'book-1', approvedBy: 'staff', refundType: 'FULL' });
    expect(f.intent()).toMatchObject({ initiatedBy: 'STAFF', performedBy: 'staff', refund: { refundAmount: 28000 }, allocations: [
      expect.objectContaining({ paymentId: 'pay-a', amount: 8000, execution: 'REVIEW' }),
      expect.objectContaining({ paymentId: 'pay-b', amount: 20000, execution: 'AUTOMATIC' }),
    ] });
    expect(f.refund.createRefundRequestInTx).not.toHaveBeenCalled();
    expect(f.p.booking.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'CANCELLED' }) }));
  });
  it('treats partial amount as additional budget after past refunds', async () => {
    const f = fixture();
    await f.handler.execute({ bookingId: 'book-1', approvedBy: 'staff', refundType: 'PARTIAL', refundAmount: 10000 });
    expect(f.intent().refund.refundAmount).toBe(10000);
    expect(f.intent().allocations.reduce((n: number, a: { amount: number }) => n + a.amount, 0)).toBe(10000);
  });
  it('rejects a partial budget greater than all available captured money', async () => {
    const f = fixture();
    await expect(f.handler.execute({ bookingId: 'book-1', approvedBy: 'staff', refundType: 'PARTIAL', refundAmount: 28001 })).rejects.toThrow();
    expect(f.p.outboxEvent.create).not.toHaveBeenCalled();
  });
  it('records explicit NONE as zero without losing the captured totals', async () => {
    const f = fixture();
    await f.handler.execute({ bookingId: 'book-1', approvedBy: 'staff', refundType: 'NONE' });
    expect(f.intent()).toMatchObject({ refund: { paidAmount: 30000, refundAmount: 0 }, allocations: [] });
  });
});
