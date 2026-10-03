import { DepositPaidEventHandler } from './deposit-paid.handler';
import { buildPrisma, buildRlsTransaction, mockBooking } from '../testing/booking-test-helpers';
import { BookingStatus, DeliveryType } from '@prisma/client';

function buildCls() {
  return {
    run: jest.fn(async (fn: () => Promise<unknown>) => fn()),
    set: jest.fn(),
  };
}

function buildHandler() {
  const prisma = { ...buildPrisma(), outboxEvent: { create: jest.fn(), upsert: jest.fn().mockResolvedValue({}) } };
  let subscriber:
    | ((envelope: { payload: { bookingId: string | null; paymentId: string; invoiceId: string } }) => Promise<void>)
    | null = null;
  const eb = {
    subscribe: jest.fn((_: string, _consumerId: string, cb: unknown) => {
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
    expect(eb.subscribe).toHaveBeenCalledWith(
      'finance.payment.deposit_paid', 'bookings.deposit-paid.v1', expect.any(Function),
    );
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


describe('durable operational confirmation', () => {
  it('writes the online request once across a duplicate event and preserves money', async () => {
    const { prisma, getSubscriber, eb } = buildHandler();
    const booking = { ...mockBooking, status: BookingStatus.AWAITING_PAYMENT, deliveryType: DeliveryType.ONLINE };
    prisma.booking.findFirst = jest.fn().mockResolvedValueOnce(booking).mockResolvedValueOnce({ ...booking, status: BookingStatus.DEPOSIT_PAID });
    await getSubscriber()(makeEnvelope());
    await getSubscriber()(makeEnvelope());
    expect(prisma.outboxEvent.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.outboxEvent.upsert).toHaveBeenCalledWith({
      where: { id: expect.any(String) }, update: {},
      create: expect.objectContaining({ eventType: 'bookings.zoom.create_requested', aggregateId: 'book-1', status: 'PENDING_V2', deliveryLane: 'PENDING_V2' }),
    });
    expect(prisma.booking.updateMany.mock.calls[0][0].data).toEqual({ status: BookingStatus.DEPOSIT_PAID, confirmedAt: expect.any(Date) });
    expect(prisma.invoice.create).not.toHaveBeenCalled();
    expect(prisma.payment.findFirst).not.toHaveBeenCalled();
    expect(eb.publish).not.toHaveBeenCalled();
  });
  it.each([BookingStatus.CANCELLED, BookingStatus.COMPLETED, BookingStatus.EXPIRED, BookingStatus.NO_SHOW])('does not provision after terminal %s', async (status) => {
    const { prisma, getSubscriber } = buildHandler();
    prisma.booking.findFirst = jest.fn().mockResolvedValue({ ...mockBooking, status, deliveryType: DeliveryType.ONLINE });
    await getSubscriber()(makeEnvelope());
    expect(prisma.outboxEvent.upsert).not.toHaveBeenCalled();
  });
  it('does not provision an in-person appointment', async () => {
    const { prisma, getSubscriber } = buildHandler();
    prisma.booking.findFirst = jest.fn().mockResolvedValue({ ...mockBooking, deliveryType: DeliveryType.IN_PERSON });
    await getSubscriber()(makeEnvelope());
    expect(prisma.outboxEvent.upsert).not.toHaveBeenCalled();
  });
  it('does not write audit or provisioning after a failed status CAS', async () => {
    const { prisma, getSubscriber } = buildHandler();
    prisma.booking.findFirst = jest.fn().mockResolvedValue({ ...mockBooking, deliveryType: DeliveryType.ONLINE });
    prisma.booking.updateMany.mockResolvedValue({ count: 0 });
    await expect(getSubscriber()(makeEnvelope())).rejects.toThrow();
    expect(prisma.outboxEvent.upsert).not.toHaveBeenCalled();
    expect(prisma.bookingStatusLog.create).not.toHaveBeenCalled();
  });
});

describe('deposit transaction boundaries', () => {
  it('writes confirmation, audit and Zoom intent through the same transaction client', async () => {
    const prisma = buildPrisma();
    prisma.booking.findFirst = jest.fn().mockResolvedValue({ ...mockBooking, deliveryType: DeliveryType.ONLINE });
    const tx = { ...buildPrisma(), outboxEvent: { upsert: jest.fn().mockResolvedValue({}) } };
    let subscriber!: (event: ReturnType<typeof makeEnvelope>) => Promise<void>;
    const eventBus = { subscribe: jest.fn((_event, _consumer, cb) => { subscriber = cb; }) };
    const transaction = { withTransaction: jest.fn(async (cb: (client: typeof tx) => Promise<unknown>) => cb(tx)) };
    new DepositPaidEventHandler(prisma as never, transaction as never, eventBus as never, buildCls() as never).register();
    await subscriber(makeEnvelope());
    expect(transaction.withTransaction).toHaveBeenCalledTimes(1);
    expect(tx.booking.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.bookingStatusLog.create).toHaveBeenCalledTimes(1);
    expect(tx.outboxEvent.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.booking.updateMany).not.toHaveBeenCalled();
    expect(prisma.bookingStatusLog.create).not.toHaveBeenCalled();
    expect(prisma.outboxEvent.create).not.toHaveBeenCalled();
  });
});

it('retains an existing confirmation timestamp and meeting without reprovisioning', async () => {
  const { prisma, getSubscriber } = buildHandler();
  const confirmedAt = new Date('2026-01-01');
  prisma.booking.findFirst = jest.fn().mockResolvedValue({ ...mockBooking, confirmedAt, zoomMeetingId: 'existing-meeting', deliveryType: DeliveryType.ONLINE });
  await getSubscriber()(makeEnvelope());
  expect(prisma.booking.updateMany.mock.calls[0][0].data.confirmedAt).toEqual(confirmedAt);
  expect(prisma.outboxEvent.upsert).not.toHaveBeenCalled();
});
