import { INestApplication } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../../src/infrastructure/database';
import { CheckInBookingHandler } from '../../../src/modules/bookings/check-in-booking/check-in-booking.handler';
import { CompleteBookingHandler } from '../../../src/modules/bookings/complete-booking/complete-booking.handler';
import { ExpireBookingHandler } from '../../../src/modules/bookings/expire-booking/expire-booking.handler';
import { NoShowBookingHandler } from '../../../src/modules/bookings/no-show-booking/no-show-booking.handler';
import { BookingExpiryCron } from '../../../src/modules/ops/cron-tasks/booking-expiry.cron';
import { createRealE2eApp } from '../../helpers/create-real-e2e-app';

const describeReal = process.env.REAL_E2E_DATABASE_URL ? describe : describe.skip;

// AppModule + real disposable PostgreSQL. External providers remain mocked by
// setup-e2e; these cases prove stored booking/financial effects, not delivery.
describeReal('Booking lifecycle policy preserves money and legacy records (real DB)', () => {
  jest.setTimeout(60_000);
  let app: INestApplication;
  let prisma: PrismaService;
  let sequence = Math.floor(Math.random() * 100_000_000) + 500_000_000;

  beforeAll(async () => {
    ({ app, prisma } = await createRealE2eApp());
  });
  afterAll(async () => { if (app) await app.close(); });

  async function booking(status: BookingStatus, expiresAt: Date | null = null, historical = false) {
    const scheduledAt = new Date(Date.now() + 5 * 86_400_000);
    return prisma.booking.create({
      data: {
        branchId: randomUUID(), clientId: randomUUID(), employeeId: randomUUID(),
        serviceId: randomUUID(), bookingNumber: sequence++, status,
        deliveryType: 'IN_PERSON', source: 'RECEPTION', durationMins: 60,
        scheduledAt, endsAt: new Date(scheduledAt.getTime() + 3_600_000),
        price: 30_000, currency: 'SAR', expiresAt,
        isHistoricalImport: historical,
        createdAt: new Date(Date.now() - 30 * 86_400_000),
      },
    });
  }

  async function partialInvoice(row: Awaited<ReturnType<typeof booking>>) {
    return prisma.invoice.create({
      data: {
        bookingId: row.id, branchId: row.branchId, clientId: row.clientId,
        employeeId: row.employeeId, subtotal: 30_000, vatRate: 0, vatAmt: 0,
        total: 30_000, currency: 'SAR', status: 'PARTIALLY_PAID',
        payments: { create: { amount: 10_000, method: 'CASH', status: 'COMPLETED' } },
      },
      include: { payments: true },
    });
  }

  it.each([BookingStatus.PENDING, BookingStatus.AWAITING_PAYMENT])(
    'leaves a month-old %s without an explicit deadline completely unchanged', async status => {
      const row = await booking(status);
      await app.get(BookingExpiryCron).execute();
      await expect(app.get(ExpireBookingHandler).execute({ bookingId: row.id, changedBy: 'test' }))
        .rejects.toThrow();
      expect(await prisma.booking.findUniqueOrThrow({ where: { id: row.id } })).toEqual(row);
      expect(await prisma.bookingStatusLog.count({ where: { bookingId: row.id } })).toBe(0);
      expect(await prisma.outboxEvent.count({ where: { aggregateId: row.id } })).toBe(0);
    },
  );

  it('expires an explicit elapsed hold but preserves future and historical deadlines', async () => {
    const elapsed = await booking(BookingStatus.AWAITING_PAYMENT, new Date(Date.now() - 60_000));
    const future = await booking(BookingStatus.AWAITING_PAYMENT, new Date(Date.now() + 60_000));
    const historical = await booking(BookingStatus.PENDING, new Date(Date.now() - 60_000), true);
    await app.get(BookingExpiryCron).execute();
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: elapsed.id } })).status)
      .toBe(BookingStatus.EXPIRED);
    expect(await prisma.booking.findUniqueOrThrow({ where: { id: future.id } })).toEqual(future);
    expect(await prisma.booking.findUniqueOrThrow({ where: { id: historical.id } })).toEqual(historical);
  });

  it('checks in and completes a deposit booking while its unpaid balance stays owed', async () => {
    const row = await booking(BookingStatus.DEPOSIT_PAID, new Date(Date.now() - 60_000));
    const invoice = await partialInvoice(row);
    await app.get(BookingExpiryCron).execute();
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: row.id } })).status)
      .toBe(BookingStatus.DEPOSIT_PAID);
    const arrived = await app.get(CheckInBookingHandler).execute({ bookingId: row.id, changedBy: 'test' });
    expect(arrived.status).toBe(BookingStatus.DEPOSIT_PAID);
    expect(arrived.checkedInAt).not.toBeNull();
    await app.get(CompleteBookingHandler).execute({ bookingId: row.id, changedBy: 'test' });
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: row.id } })).status)
      .toBe(BookingStatus.COMPLETED);
    expect(await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id }, include: { payments: true } }))
      .toEqual(invoice);
    expect(Number(invoice.total) - invoice.payments.reduce((sum, p) => sum + Number(p.amount), 0)).toBe(20_000);
  });

  it('allows arrival of an unpaid reception-confirmed booking without changing the invoice', async () => {
    const row = await booking(BookingStatus.CONFIRMED);
    const invoice = await prisma.invoice.create({
      data: {
        bookingId: row.id, branchId: row.branchId, clientId: row.clientId,
        employeeId: row.employeeId, subtotal: 30_000, vatRate: 0, vatAmt: 0,
        total: 30_000, currency: 'SAR', status: 'ISSUED',
      },
    });
    await app.get(BookingExpiryCron).execute();
    const arrived = await app.get(CheckInBookingHandler).execute({ bookingId: row.id, changedBy: 'test' });
    expect(arrived.status).toBe(BookingStatus.CONFIRMED);
    expect(arrived.checkedInAt).not.toBeNull();
    expect(await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } })).toEqual(invoice);
    expect(await prisma.payment.count({ where: { invoiceId: invoice.id } })).toBe(0);
  });

  it('records no-show for a deposit booking without refunding its money', async () => {
    const row = await booking(BookingStatus.DEPOSIT_PAID);
    const invoice = await partialInvoice(row);
    await app.get(NoShowBookingHandler).execute({ bookingId: row.id, changedBy: 'test' });
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: row.id } })).status)
      .toBe(BookingStatus.NO_SHOW);
    expect(await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id }, include: { payments: true } }))
      .toEqual(invoice);
    expect(await prisma.refundRequest.count({ where: { invoiceId: invoice.id } })).toBe(0);
  });
});
