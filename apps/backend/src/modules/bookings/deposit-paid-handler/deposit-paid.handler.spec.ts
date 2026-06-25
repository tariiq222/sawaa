import { DepositPaidEventHandler } from './deposit-paid.handler';
import { buildPrisma, buildRlsTransaction, mockBooking } from '../testing/booking-test-helpers';
import { BookingStatus } from '@prisma/client';

function buildCls() {
  return {
    run: jest.fn(async (fn: () => Promise<unknown>) => fn()),
    set: jest.fn(),
  };
}

function buildHandler() {
  const prisma = buildPrisma();
  let subscriber:
    | ((envelope: { payload: { bookingId: string | null; paymentId: string; invoiceId: string } }) => Promise<void>)
    | null = null;
  const eb = {
    subscribe: jest.fn((_: string, cb: unknown) => {
      subscriber = cb as typeof subscriber;
    }),
    publish: jest.fn().mockResolvedValue(undefined),
  };
  const cls = buildCls();
  const handler = new DepositPaidEventHandler(
    prisma as never,
    buildRlsTransaction(prisma) as never,
    eb as never,
    cls as never,
  );
  handler.register();
  return { prisma, eb, handler, cls, getSubscriber: () => subscriber! };
}

const makeEnvelope = (
  overrides: Partial<{ bookingId: string | null; paymentId: string; invoiceId: string }> = {},
) => ({
  payload: { bookingId: 'book-1', paymentId: 'pay-1', invoiceId: 'inv-1', ...overrides },
});

describe('DepositPaidEventHandler', () => {
  it('registers a subscriber on finance.payment.deposit_paid', () => {
    const { eb } = buildHandler();
    expect(eb.subscribe).toHaveBeenCalledWith('finance.payment.deposit_paid', expect.any(Function));
  });

  it('moves a PENDING booking to DEPOSIT_PAID', async () => {
    const { prisma, getSubscriber } = buildHandler();
    prisma.booking.findFirst = jest.fn().mockResolvedValue({ ...mockBooking, status: BookingStatus.PENDING });

    await getSubscriber()(makeEnvelope());

    expect(prisma.booking.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: BookingStatus.DEPOSIT_PAID }) }),
    );
  });

  it('moves an AWAITING_PAYMENT booking to DEPOSIT_PAID', async () => {
    const { prisma, getSubscriber } = buildHandler();
    prisma.booking.findFirst = jest
      .fn()
      .mockResolvedValue({ ...mockBooking, status: BookingStatus.AWAITING_PAYMENT });

    await getSubscriber()(makeEnvelope());

    expect(prisma.booking.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: BookingStatus.DEPOSIT_PAID }) }),
    );
  });

  it('writes a BookingStatusLog with a deposit reason', async () => {
    const { prisma, getSubscriber } = buildHandler();
    prisma.booking.findFirst = jest.fn().mockResolvedValue({ ...mockBooking, status: BookingStatus.PENDING });

    await getSubscriber()(makeEnvelope());

    expect(prisma.bookingStatusLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          fromStatus: BookingStatus.PENDING,
          toStatus: BookingStatus.DEPOSIT_PAID,
          reason: 'deposit:pay-1',
        }),
      }),
    );
  });

  it('is idempotent — skips a booking already in DEPOSIT_PAID', async () => {
    const { prisma, getSubscriber } = buildHandler();
    prisma.booking.findFirst = jest
      .fn()
      .mockResolvedValue({ ...mockBooking, status: BookingStatus.DEPOSIT_PAID });

    await getSubscriber()(makeEnvelope());

    expect(prisma.booking.updateMany).not.toHaveBeenCalled();
  });

  it('skips a CONFIRMED booking (no valid DEPOSIT_CONFIRMED transition)', async () => {
    const { prisma, getSubscriber } = buildHandler();
    prisma.booking.findFirst = jest.fn().mockResolvedValue({ ...mockBooking, status: BookingStatus.CONFIRMED });

    await getSubscriber()(makeEnvelope());

    expect(prisma.booking.updateMany).not.toHaveBeenCalled();
  });

  it('skips when the booking is not found', async () => {
    const { prisma, getSubscriber } = buildHandler();
    prisma.booking.findFirst = jest.fn().mockResolvedValue(null);

    await getSubscriber()(makeEnvelope());

    expect(prisma.booking.updateMany).not.toHaveBeenCalled();
  });

  it('skips package-purchase events with no bookingId', async () => {
    const { prisma, getSubscriber } = buildHandler();

    await getSubscriber()(makeEnvelope({ bookingId: null }));

    expect(prisma.booking.updateMany).not.toHaveBeenCalled();
  });
});
