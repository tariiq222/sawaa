import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../../src/infrastructure/database';
import { createRealE2eApp } from '../../helpers/create-real-e2e-app';
import { CancelProgramHandler } from '../../../src/modules/bookings/cancel-program/cancel-program.handler';
import { RejectCancelBookingHandler } from '../../../src/modules/bookings/reject-cancel-booking/reject-cancel-booking.handler';
import { ScheduleProgramHandler } from '../../../src/modules/bookings/schedule-program/schedule-program.handler';
import { CancellationRefundIntentService } from '../../../src/modules/finance/cancellation-refund/cancellation-refund-intent.service';
import { stableEventId } from '../../../src/common/events';
const describeReal = process.env.REAL_E2E_DATABASE_URL ? describe : describe.skip;
describeReal('center program cancellation (real PostgreSQL)', () => {
  jest.setTimeout(60_000);
  let app: Awaited<ReturnType<typeof createRealE2eApp>>['app'];
  let prisma: PrismaService;
  let handler: CancelProgramHandler;
  beforeAll(async () => { ({ app, prisma } = await createRealE2eApp()); handler = app.get(CancelProgramHandler); });
  afterAll(async () => { await app?.close(); });
  async function fixture(started = false) {
    const client = await prisma.client.create({ data: { name: 'Program cancellation test', isActive: true } });
    const program = await prisma.program.create({ data: { departmentId: randomUUID(), branchId: randomUUID(), nameAr: 'برنامج الاختبار', daysCount: 2, hoursPerDay: 1, minParticipants: 1, maxParticipants: 5, enrolledCount: 1, price: 10000, currency: 'SAR', status: 'SCHEDULED', startDate: new Date(Date.now() + (started ? -1 : 1) * 86400000) } });
    const booking = await prisma.booking.create({ data: { clientId: client.id, bookingNumber: Math.floor(Math.random() * 100000000) + 700000000, branchId: program.branchId, employeeId: randomUUID(), programId: program.id, bookingType: 'GROUP', status: 'CONFIRMED', source: 'RECEPTION', deliveryType: 'IN_PERSON', durationMins: 60, scheduledAt: program.startDate!, endsAt: new Date(program.startDate!.getTime() + 3600000), price: 10000, currency: 'SAR' } });
    await prisma.programEnrollment.create({ data: { programId: program.id, clientId: client.id, bookingId: booking.id } });
    const invoice = await prisma.invoice.create({ data: { bookingId: booking.id, clientId: client.id, branchId: program.branchId, employeeId: booking.employeeId, subtotal: 10000, total: 10000, vatAmt: 0, vatRate: 0, currency: 'SAR', status: 'PAID', payments: { create: { amount: 10000, status: 'COMPLETED', method: 'CASH' } } }, include: { payments: true } });
    return { client, program, booking, invoice };
  }
  it('commits cancellation first then queues cash review once, preserving captured accounting', async () => {
    const f = await fixture();
    const quote = await handler.preview(f.program.id);
    const result = await handler.execute(f.program.id, { reason: 'تعذر التنفيذ', quoteToken: quote.quoteToken }, 'staff1');
    expect(result.cancelledEnrollments).toBe(1);
    expect(await handler.execute(f.program.id, { reason: 'retry', quoteToken: 'stale' }, 'staff1')).toEqual(result);
    expect(await prisma.refundRequest.count({ where: { invoiceId: f.invoice.id } })).toBe(0);
    const eventId = stableEventId(`booking:${f.booking.id}:program-cancel:${f.program.id}`);
    const event = await prisma.outboxEvent.findUniqueOrThrow({ where: { id: eventId } });
    const intent = (event.payload as any).payload.centerCancellation;
    await app.get(CancellationRefundIntentService).execute(eventId, f.booking.id, f.client.id, intent);
    await app.get(CancellationRefundIntentService).execute(eventId, f.booking.id, f.client.id, intent);
    const requests = await prisma.refundRequest.findMany({ where: { invoiceId: f.invoice.id } });
    expect(requests).toHaveLength(1);
    expect(requests[0].status).toBe('PENDING_REVIEW');
    expect(Number(requests[0].amount)).toBe(10000);
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: f.invoice.payments[0].id } })).status).toBe('COMPLETED');
  });
  it('requires revised money confirmation and preserves completed participant status', async () => {
    const f = await fixture(true);
    const quote = await handler.preview(f.program.id);
    await prisma.booking.update({ where: { id: f.booking.id }, data: { status: 'COMPLETED' } });
    await expect(handler.execute(f.program.id, { reason: 'Closed', quoteToken: quote.quoteToken, refunds: [{ bookingId: f.booking.id, amount: 2500 }] }, 'staff1')).rejects.toMatchObject({ status: 409 });
    const fresh = await handler.preview(f.program.id);
    const result = await handler.execute(f.program.id, { reason: 'Closed', quoteToken: fresh.quoteToken, refunds: [{ bookingId: f.booking.id, amount: 2500 }] }, 'staff1');
    expect(result).toMatchObject({ cancelledEnrollments: 0, skippedEnrollments: 1 });
    expect(result.participants[0].refundAmount).toBe(2500);
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: f.booking.id } })).status).toBe('COMPLETED');
  });
  it('breaks a Booking->Program lock inversion with bounded conflict and permits fresh retry', async () => {
    const f = await fixture();
    const quote = await handler.preview(f.program.id);
    let release!: () => void;
    let locked!: () => void;
    const held = new Promise<void>(resolve => { locked = resolve; });
    const unlock = new Promise<void>(resolve => { release = resolve; });
    const competing = prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "Booking" WHERE id = ${f.booking.id} FOR UPDATE`;
      locked(); await unlock;
      await tx.program.update({ where: { id: f.program.id }, data: { enrolledCount: 1 } });
    }, { timeout: 10000 });
    await held;
    try { await expect(handler.execute(f.program.id, { reason: 'Closed', quoteToken: quote.quoteToken }, 'staff1')).rejects.toMatchObject({ status: 409 }); }
    finally { release(); await competing; }
    expect((await prisma.program.findUniqueOrThrow({ where: { id: f.program.id } })).status).toBe('SCHEDULED');
    const fresh = await handler.preview(f.program.id);
    await handler.execute(f.program.id, { reason: 'Closed', quoteToken: fresh.quoteToken }, 'staff1');
    await expect(app.get(ScheduleProgramHandler).execute(f.program.id, { startDate: new Date(Date.now() + 172800000).toISOString() })).rejects.toThrow();
    expect((await prisma.program.findUniqueOrThrow({ where: { id: f.program.id } })).status).toBe('CANCELLED');
  });
  it('schedules a participant with a pending cancellation request then rejects the request without restoring placeholder dates', async () => {
    const f = await fixture();
    await prisma.program.update({ where: { id: f.program.id }, data: { status: 'OPEN', startDate: null } });
    await prisma.booking.update({ where: { id: f.booking.id }, data: { status: 'CANCEL_REQUESTED' } });
    await prisma.bookingStatusLog.create({ data: { bookingId: f.booking.id, fromStatus: 'CONFIRMED', toStatus: 'CANCEL_REQUESTED', changedBy: f.client.id } });
    const scheduledAt = new Date(Date.now() + 5 * 86400000);
    await app.get(ScheduleProgramHandler).execute(f.program.id, { startDate: scheduledAt.toISOString() });
    const pending = await prisma.booking.findUniqueOrThrow({ where: { id: f.booking.id } });
    expect(pending.status).toBe('CANCEL_REQUESTED');
    expect(pending.scheduledAt).toEqual(scheduledAt);
    expect(pending.endsAt).toEqual(new Date(scheduledAt.getTime() + 3600000));
    await app.get(RejectCancelBookingHandler).execute({ bookingId: f.booking.id, rejectedBy: 'staff1', rejectReason: 'Continue enrollment' });
    const restored = await prisma.booking.findUniqueOrThrow({ where: { id: f.booking.id } });
    expect(restored.status).toBe('CONFIRMED');
    expect(restored.scheduledAt).toEqual(scheduledAt);
    expect(restored.endsAt).toEqual(pending.endsAt);
  });
  it('rolls back booking, log and program when outbox capture fails', async () => {
    const f = await fixture();
    const quote = await handler.preview(f.program.id);
    const duplicateId = stableEventId(`booking:${f.booking.id}:program-cancel:${f.program.id}`);
    await prisma.outboxEvent.create({ data: { id: duplicateId, aggregateId: f.booking.id, eventType: 'test.collision', payload: {} } });
    await expect(handler.execute(f.program.id, { reason: 'Closed', quoteToken: quote.quoteToken }, 'staff1')).rejects.toThrow();
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: f.booking.id } })).status).toBe('CONFIRMED');
    expect((await prisma.program.findUniqueOrThrow({ where: { id: f.program.id } })).status).toBe('SCHEDULED');
    expect(await prisma.bookingStatusLog.count({ where: { bookingId: f.booking.id } })).toBe(0);
  });
});
