import { INestApplication } from '@nestjs/common';
import { BookingStatus, Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../../src/infrastructure/database';
import { RejectCancelBookingHandler } from '../../../src/modules/bookings/reject-cancel-booking/reject-cancel-booking.handler';
import { ApproveCancelBookingHandler } from '../../../src/modules/bookings/approve-cancel-booking/approve-cancel-booking.handler';
import { OnBookingCancelApprovedRefundHandler } from '../../../src/modules/finance/events/on-booking-cancel-approved.handler';
import { DepositPaidEvent } from '../../../src/modules/finance/events/deposit-paid.event';
import { createRealE2eApp } from '../../helpers/create-real-e2e-app';

const describeReal = process.env.REAL_E2E_DATABASE_URL ? describe : describe.skip;
describeReal('Legacy cancellation reconciliation (real DB)', () => {
  jest.setTimeout(60_000);
  let app: INestApplication;
  let prisma: PrismaService;
  let sequence = Math.floor(Math.random() * 100_000_000) + 600_000_000;
  beforeAll(async () => { ({ app, prisma } = await createRealE2eApp()); });
  afterAll(async () => { if (app) await app.close(); });

  async function fixture(original: BookingStatus = 'AWAITING_PAYMENT', expiresAt: Date | null = null, online = false) {
    const scheduledAt = new Date(Date.now() + 5 * 86400000);
    const booking = await prisma.booking.create({ data: {
      branchId: randomUUID(), clientId: randomUUID(), employeeId: randomUUID(), serviceId: randomUUID(), bookingNumber: sequence++,
      status: 'CANCEL_REQUESTED', deliveryType: online ? 'ONLINE' : 'IN_PERSON', source: 'RECEPTION', durationMins: 60,
      scheduledAt, endsAt: new Date(scheduledAt.getTime() + 3600000), price: 30000, currency: 'SAR', expiresAt,
    } });
    await prisma.bookingStatusLog.create({ data: { bookingId: booking.id, fromStatus: original, toStatus: 'CANCEL_REQUESTED', changedBy: 'client' } });
    const invoice = await prisma.invoice.create({ data: {
      bookingId: booking.id, branchId: booking.branchId, clientId: booking.clientId, employeeId: booking.employeeId,
      subtotal: 30000, total: 30000, vatRate: 0, vatAmt: 0, currency: 'SAR', status: 'ISSUED',
    } });
    return { booking, invoice };
  }
  const reject = (bookingId: string) => app.get(RejectCancelBookingHandler).execute({ bookingId, rejectedBy: 'staff', rejectReason: 'Declined' });

  it.each(['COMPLETED', 'REFUNDED'] as const)('restores full %s captures and stages Zoom without changing money', async status => {
    const f = await fixture('AWAITING_PAYMENT', null, true);
    await prisma.payment.create({ data: { invoiceId: f.invoice.id, amount: 30000, refundedAmount: status === 'REFUNDED' ? 30000 : 0, status, method: 'CASH' } });
    const before = await prisma.invoice.findUniqueOrThrow({ where: { id: f.invoice.id }, include: { payments: true } });
    const restored = await reject(f.booking.id);
    expect(restored.status).toBe('CONFIRMED');
    expect(restored.confirmedAt).toBeInstanceOf(Date);
    expect(restored.expiresAt).toBeNull();
    expect(await prisma.invoice.findUniqueOrThrow({ where: { id: f.invoice.id }, include: { payments: true } })).toEqual(before);
    expect(await prisma.outboxEvent.count({ where: { aggregateId: f.booking.id, eventType: 'bookings.zoom.create_requested' } })).toBe(1);
  });
  it('honors durable deposit evidence without reading current service settings', async () => {
    const f = await fixture();
    const payment = await prisma.payment.create({ data: { invoiceId: f.invoice.id, amount: 10000, status: 'COMPLETED', method: 'CASH' } });
    const event = new DepositPaidEvent({ bookingId: f.booking.id, invoiceId: f.invoice.id, paymentId: payment.id, amount: 10000, currency: 'SAR' });
    await prisma.outboxEvent.create({ data: { id: event.eventId, aggregateId: payment.id, eventType: event.eventName, payload: event.toEnvelope() as unknown as Prisma.InputJsonValue } });
    const restored = await reject(f.booking.id);
    expect(restored.status).toBe('DEPOSIT_PAID');
    expect(restored.expiresAt).toBeNull();
  });
  it('preserves null deadline and unconfirmed state for partial money without deposit evidence', async () => {
    const f = await fixture();
    await prisma.payment.create({ data: { invoiceId: f.invoice.id, amount: 10000, status: 'COMPLETED', method: 'CASH' } });
    const restored = await reject(f.booking.id);
    expect(restored.status).toBe('AWAITING_PAYMENT');
    expect(restored.expiresAt).toBeNull();
  });
  it('preserves reception unpaid confirmation and rearms an explicit unconfirmed deadline', async () => {
    const unpaid = await fixture('CONFIRMED');
    expect((await reject(unpaid.booking.id)).status).toBe('CONFIRMED');
    const expiring = await fixture('PENDING', new Date(0));
    expect((await reject(expiring.booking.id)).expiresAt!.getTime()).toBeGreaterThan(Date.now());
  });
  it('serializes two rejection decisions so only one status log is appended', async () => {
    const f = await fixture();
    const results = await Promise.allSettled([reject(f.booking.id), reject(f.booking.id)]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect(await prisma.bookingStatusLog.count({ where: { bookingId: f.booking.id } })).toBe(2);
  });
  it('cancels with all cash captures frozen and duplicate delivery creates only review requests', async () => {
    const f = await fixture('CONFIRMED');
    await prisma.payment.createMany({ data: [10000, 20000].map(amount => ({ invoiceId: f.invoice.id, amount, status: 'COMPLETED' as const, method: 'CASH' as const })) });
    const before = await prisma.invoice.findUniqueOrThrow({ where: { id: f.invoice.id }, include: { payments: { orderBy: { id: 'asc' } } } });
    await app.get(ApproveCancelBookingHandler).execute({ bookingId: f.booking.id, approvedBy: 'staff', refundType: 'FULL' });
    const outbox = await prisma.outboxEvent.findFirstOrThrow({ where: { aggregateId: f.booking.id, eventType: 'bookings.booking.cancel_approved' } });
    const envelope = outbox.payload as any;
    expect(envelope.payload.staffCancellation.refund.refundAmount).toBe(30000);
    expect(envelope.payload.staffCancellation.initiatedBy).toBe('STAFF');
    const subscriber = app.get(OnBookingCancelApprovedRefundHandler);
    await subscriber.handle(envelope);
    await subscriber.handle(envelope);
    const requests = await prisma.refundRequest.findMany({ where: { invoiceId: f.invoice.id } });
    expect(requests).toHaveLength(2);
    expect(requests.every(r => r.status === 'PENDING_REVIEW')).toBe(true);
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: f.booking.id } })).status).toBe('CANCELLED');
    expect(await prisma.invoice.findUniqueOrThrow({ where: { id: f.invoice.id }, include: { payments: { orderBy: { id: 'asc' } } } })).toEqual(before);
  });
});
