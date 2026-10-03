import { BookingStatus } from '@prisma/client';
import { BookingZoomCreateRequestedEvent } from '../events/booking-zoom-create-requested.event';
import { RejectCancelBookingHandler } from './reject-cancel-booking.handler';
import { buildPrisma, buildRlsTransaction, buildEventBus, mockBooking } from '../testing/booking-test-helpers';

function fixture(original: BookingStatus = 'AWAITING_PAYMENT', overrides: Record<string, unknown> = {}) {
  const p = buildPrisma();
  const row = { ...mockBooking, status: BookingStatus.CANCEL_REQUESTED, expiresAt: null, confirmedAt: null, ...overrides };
  p.booking.findFirst.mockResolvedValue(row);
  p.bookingStatusLog.findFirst.mockResolvedValue({ fromStatus: original });
  p.invoice.findFirst.mockResolvedValue({ id: 'inv-1', total: 30000, currency: 'SAR' });
  p.invoice.findMany.mockResolvedValue([{ id: 'inv-1', total: 30000, currency: 'SAR' }]);
  const payment = { id: 'pay-1', invoiceId: 'inv-1', amount: 10000, status: 'COMPLETED', currency: 'SAR' };
  Object.assign(p.payment, { findMany: jest.fn().mockResolvedValue([payment]) });
  Object.assign(p.outboxEvent, { findMany: jest.fn().mockResolvedValue([]), upsert: jest.fn() });
  p.$queryRaw.mockResolvedValue([]);
  const run = () => new RejectCancelBookingHandler(p as never, buildRlsTransaction(p) as never, buildEventBus() as never)
    .execute({ bookingId: row.id, rejectedBy: 'staff', rejectReason: 'Declined' });
  return { p: p as typeof p & { payment: { findMany: jest.Mock }; outboxEvent: { findMany: jest.Mock; upsert: jest.Mock } }, payment, row, run,
    data: () => p.booking.updateMany.mock.calls[0][0].data };
}

describe('Legacy rejection reconciles captured money', () => {
  it.each(['COMPLETED', 'PARTIALLY_REFUNDED', 'REFUNDED'])('fully captured %s payment confirms despite refunds', async status => {
    const f = fixture();
    f.p.payment.findMany.mockResolvedValue([{ ...f.payment, amount: 30000, status, refundedAmount: 10000 }]);
    await f.run();
    expect(f.data()).toMatchObject({ status: 'CONFIRMED', expiresAt: null, confirmedAt: expect.any(Date) });
  });
  it('uses durable qualified deposit evidence after configuration changes', async () => {
    const f = fixture();
    f.p.outboxEvent.findMany.mockResolvedValue([{ payload: { payload: { bookingId: f.row.id, invoiceId: 'inv-1', paymentId: 'pay-1' } } }]);
    await f.run();
    expect(f.data()).toMatchObject({ status: 'DEPOSIT_PAID', expiresAt: null, confirmedAt: expect.any(Date) });
  });
  it('does not infer a deposit from arbitrary partial money or unrelated evidence', async () => {
    const f = fixture();
    f.p.outboxEvent.findMany.mockResolvedValue([{ payload: { payload: { bookingId: 'other', invoiceId: 'inv-1', paymentId: 'pay-1' } } }]);
    await f.run();
    expect(f.data()).toMatchObject({ status: 'AWAITING_PAYMENT', expiresAt: null });
  });
  it('preserves reception confirmation without payment', async () => {
    const f = fixture('CONFIRMED');
    f.p.payment.findMany.mockResolvedValue([]);
    await f.run();
    expect(f.data()).toMatchObject({ status: 'CONFIRMED', expiresAt: null });
  });
  it('preserves original deposit confirmation without replaying proof', async () => {
    const f = fixture('DEPOSIT_PAID');
    await f.run();
    expect(f.data()).toMatchObject({ status: 'DEPOSIT_PAID', expiresAt: null });
  });
  it('preserves the original confirmation timestamp', async () => {
    const confirmedAt = new Date('2026-01-01T00:00:00Z');
    const f = fixture('CONFIRMED', { confirmedAt });
    await f.run();
    expect(f.data().confirmedAt).toEqual(confirmedAt);
  });
  it.each([{ invoiceId: 'unrelated', paymentId: 'pay-1' }, { invoiceId: 'inv-1', paymentId: 'unrelated' }])('does not accept mismatched deposit evidence %j', async identifiers => {
    const f = fixture();
    f.p.outboxEvent.findMany.mockResolvedValue([{ payload: { payload: { bookingId: f.row.id, ...identifiers } } }]);
    await f.run();
    expect(f.data().status).toBe('AWAITING_PAYMENT');
  });
  it('does not append a decision or Zoom event when the CAS loses', async () => {
    const f = fixture();
    f.p.booking.updateMany.mockResolvedValue({ count: 0 });
    await expect(f.run()).rejects.toThrow('status changed concurrently');
    expect(f.p.bookingStatusLog.create).not.toHaveBeenCalled();
    expect(f.p.outboxEvent.upsert).not.toHaveBeenCalled();
  });
  it('keeps historical bookings read-only', async () => {
    const f = fixture('CONFIRMED', { isHistoricalImport: true });
    await expect(f.run()).rejects.toThrow('Historical bookings are read-only');
    expect(f.p.booking.updateMany).not.toHaveBeenCalled();
  });
  it('rearms only an explicit prior deadline', async () => {
    const f = fixture('AWAITING_PAYMENT', { expiresAt: new Date(0) });
    await f.run();
    expect(f.data().expiresAt.getTime()).toBeGreaterThan(Date.now());
  });
  it('stages a stable Zoom request for a newly confirmed online appointment', async () => {
    const f = fixture('AWAITING_PAYMENT', { deliveryType: 'ONLINE', zoomMeetingId: null });
    f.p.payment.findMany.mockResolvedValue([{ ...f.payment, amount: 30000 }]);
    await f.run();
    expect(f.p.outboxEvent.upsert).toHaveBeenCalledWith(expect.objectContaining({ update: {}, create: expect.objectContaining({ eventType: 'bookings.zoom.create_requested' }) }));
  });
  it('queues a distinct replay-stable recovery when the original Zoom request was already consumed', async () => {
    const f = fixture('CONFIRMED', { deliveryType: 'ONLINE', zoomMeetingId: null });
    f.p.bookingStatusLog.findFirst.mockResolvedValue({ id: 'cancel-request-1', fromStatus: 'CONFIRMED' });
    const original = new BookingZoomCreateRequestedEvent({ bookingId: f.row.id, organizationId: 'org' });
    const rows = new Map<string, any>([[original.eventId, { id: original.eventId, status: 'PUBLISHED', payload: original.toEnvelope() }]]);
    // Faithful outbox upsert: an already consumed original row is not pending work.
    f.p.outboxEvent.upsert.mockImplementation(async ({ where, update, create }: any) => {
      rows.set(where.id, rows.has(where.id) ? { ...rows.get(where.id), ...update } : create);
      return rows.get(where.id);
    });
    await f.run();
    const pending = [...rows.values()].filter(row => row.status === 'PENDING_V2');
    expect(pending).toHaveLength(1);
    expect(pending[0].id).not.toBe(original.eventId);
    expect(pending[0].payload.eventId).toBe(pending[0].id);
    expect(pending[0].payload.payload.bookingId).toBe(f.row.id);
    expect(rows.get(original.eventId).status).toBe('PUBLISHED');
    await f.run();
    expect([...rows.values()].filter(row => row.status === 'PENDING_V2')).toHaveLength(1);
    f.p.bookingStatusLog.findFirst.mockResolvedValue({ id: 'cancel-request-2', fromStatus: 'CONFIRMED' });
    await f.run();
    expect([...rows.values()].filter(row => row.status === 'PENDING_V2')).toHaveLength(2);
  });
  it('reads the booking only inside the locked transaction', async () => {
    const f = fixture();
    await f.run();
    expect(f.p.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(f.p.booking.findFirst.mock.invocationCallOrder[0]);
  });
});
