import { BookingStatus, DeliveryType, InvoiceStatus, PaymentStatus, Prisma } from '@prisma/client';
import { buildBooking, buildInvoice, buildPayment, createPrismaMock, type PrismaMock } from '.';

describe('createPrismaMock', () => {
  it('resolves configured operations and exposes typed Jest mocks', async () => {
    const prisma = createPrismaMock({
      booking: { findFirst: buildBooking({ id: 'booking-42' }) },
    });

    await expect(prisma.booking.findFirst({ where: { id: 'booking-42' } }))
      .resolves.toMatchObject({ id: 'booking-42' });
    expect(prisma.booking.findFirst).toHaveBeenCalledWith({ where: { id: 'booking-42' } });
  });

  it('throws loudly for a method that was not configured', async () => {
    const prisma = createPrismaMock({
      booking: { findFirst: null },
    });

    expect(() => prisma.booking.findMany()).toThrow('unexpected Prisma call: booking.findMany');
  });

  it('throws loudly for a model that was not configured', async () => {
    const prisma = createPrismaMock();

    expect(() => prisma.payment.create({ data: {} } as never))
      .toThrow('unexpected Prisma call: payment.create');
  });

  it('throws loudly for raw queries that were not configured', async () => {
    const prisma = createPrismaMock();

    expect(() => prisma.$queryRaw`SELECT 1`).toThrow('unexpected Prisma call: $queryRaw');
  });

  it('runs interactive and array transactions against the same mock', async () => {
    const prisma = createPrismaMock({
      booking: { findFirst: buildBooking() },
    });

    await expect(prisma.$transaction(async (tx: PrismaMock) => tx.booking.findFirst()))
      .resolves.toMatchObject({ id: 'booking-1' });
    await expect(prisma.$transaction([prisma.booking.findFirst()]))
      .resolves.toEqual([expect.objectContaining({ id: 'booking-1' })]);
  });

  it('rejects an unknown operation name at compile time', () => {
    createPrismaMock({
      booking: {
        // @ts-expect-error findFirsts does not exist on the Booking delegate
        findFirsts: null,
      },
    });
  });

  it('rejects a fixture column with the wrong type at compile time', () => {
    createPrismaMock({
      booking: {
        findFirst: {
          // @ts-expect-error Booking.id is a string, not a number
          id: 42,
        },
      },
    });
  });

  it('rejects an unknown model name at compile time', () => {
    createPrismaMock({
      // @ts-expect-error `bookingz` is not a Prisma model
      bookingz: { findFirst: null },
    });
  });
});

describe('data builders', () => {
  it('builds a valid Booking row with overrides', () => {
    const booking = buildBooking({ status: BookingStatus.CONFIRMED, deliveryType: DeliveryType.ONLINE });

    expect(booking).toMatchObject({
      status: BookingStatus.CONFIRMED,
      deliveryType: DeliveryType.ONLINE,
      durationMins: 60,
      currency: 'SAR',
    });
    expect(booking.price).toBeInstanceOf(Prisma.Decimal);
    expect(booking.endsAt.getTime() - booking.scheduledAt.getTime()).toBe(60 * 60_000);
  });

  it('builds a valid Invoice row with overrides', () => {
    const invoice = buildInvoice({ status: InvoiceStatus.PAID, total: new Prisma.Decimal(23_000) });

    expect(invoice).toMatchObject({ status: InvoiceStatus.PAID, currency: 'SAR' });
    expect(Number(invoice.total)).toBe(23_000);
  });

  it('builds a valid Payment row with overrides', () => {
    const payment = buildPayment({ status: PaymentStatus.PENDING_VERIFICATION });

    expect(payment).toMatchObject({ status: PaymentStatus.PENDING_VERIFICATION, currency: 'SAR' });
    expect(payment.amount).toBeInstanceOf(Prisma.Decimal);
  });
});
