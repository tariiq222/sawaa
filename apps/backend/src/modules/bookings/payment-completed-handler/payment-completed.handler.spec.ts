import { PaymentCompletedEventHandler } from './payment-completed.handler';
import { buildPrisma, buildRlsTransaction, mockBooking } from '../testing/booking-test-helpers';
import { BookingStatus, DeliveryType } from '@prisma/client';
import { SYSTEM_CONTEXT_CLS_KEY } from '../../../common/constants';

function buildCls() {
  return {
    run: jest.fn(async (fn: () => Promise<unknown>) => fn()),
    set: jest.fn(),
  };
}

function buildZoom() {
  return { execute: jest.fn().mockResolvedValue({ id: 'zoom-1' }) };
}

function buildHandler(clsOverride?: ReturnType<typeof buildCls>, zoomOverride?: ReturnType<typeof buildZoom>) {
  const prisma = { ...buildPrisma(), outboxEvent: { create: jest.fn(), upsert: jest.fn().mockResolvedValue({}) } };
  const eb = {
    subscribe: jest.fn(),
    publish: jest.fn().mockResolvedValue(undefined),
  };
  let subscriber: ((envelope: { payload: { bookingId: string; paymentId: string; invoiceId: string } }) => Promise<void>) | null = null;
  eb.subscribe = jest.fn((_, _consumerId, cb) => { subscriber = cb as typeof subscriber; });
  const cls = clsOverride ?? buildCls();
  const zoom = zoomOverride ?? buildZoom();
  const handler = new PaymentCompletedEventHandler(prisma as never, buildRlsTransaction(prisma) as never, eb as never, cls as never);
  handler.register();
  return { prisma, eb, handler, cls, zoom, getSubscriber: () => subscriber! };
}

const makeEnvelope = (overrides: Partial<{ bookingId: string; paymentId: string; invoiceId: string }> = {}) => ({
  payload: { bookingId: 'book-1', paymentId: 'pay-1', invoiceId: 'inv-1', ...overrides },
});

describe('PaymentCompletedEventHandler', () => {
  it('registers a subscriber on finance.payment.completed', () => {
    const { eb } = buildHandler();
    expect(eb.subscribe).toHaveBeenCalledWith(
      'finance.payment.completed', 'bookings.payment-completed-confirm.v1', expect.any(Function),
    );
  });

  it('confirms PENDING booking on payment completed', async () => {
    const { prisma, getSubscriber } = buildHandler();
    prisma.booking.findFirst = jest.fn().mockResolvedValue({ ...mockBooking, status: BookingStatus.PENDING });

    await getSubscriber()(makeEnvelope());

    expect(prisma.booking.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'CONFIRMED' }) }),
    );
  });

  it('confirms AWAITING_PAYMENT booking on payment completed', async () => {
    const { prisma, getSubscriber } = buildHandler();
    prisma.booking.findFirst = jest.fn().mockResolvedValue({ ...mockBooking, status: BookingStatus.AWAITING_PAYMENT });

    await getSubscriber()(makeEnvelope());

    expect(prisma.booking.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'CONFIRMED' }) }),
    );
  });

  it('skips non-PENDING / non-AWAITING_PAYMENT bookings', async () => {
    const { prisma, getSubscriber } = buildHandler();
    prisma.booking.findFirst = jest.fn().mockResolvedValue({ ...mockBooking, status: BookingStatus.CONFIRMED });

    await getSubscriber()(makeEnvelope());

    expect(prisma.booking.updateMany).not.toHaveBeenCalled();
  });

  it('skips when booking not found', async () => {
    const { prisma, getSubscriber } = buildHandler();
    prisma.booking.findFirst = jest.fn().mockResolvedValue(null);

    await getSubscriber()(makeEnvelope());

    expect(prisma.booking.updateMany).not.toHaveBeenCalled();
  });

  it('writes BookingStatusLog on confirmation', async () => {
    const { prisma, getSubscriber } = buildHandler();
    prisma.booking.findFirst = jest.fn().mockResolvedValue({ ...mockBooking, status: BookingStatus.PENDING });

    await getSubscriber()(makeEnvelope());

    expect(prisma.bookingStatusLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ fromStatus: BookingStatus.PENDING, toStatus: 'CONFIRMED' }),
      }),
    );
  });

  it('confirms DEPOSIT_PAID booking when the remaining balance is settled', async () => {
    // The deposit was already paid → booking is DEPOSIT_PAID. The balance
    // settlement publishes finance.payment.completed and the booking must
    // move to CONFIRMED.
    const { prisma, getSubscriber } = buildHandler();
    prisma.booking.findFirst = jest.fn().mockResolvedValue({ ...mockBooking, status: BookingStatus.DEPOSIT_PAID });

    await getSubscriber()(makeEnvelope());

    expect(prisma.booking.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'CONFIRMED' }) }),
    );
    expect(prisma.bookingStatusLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ fromStatus: BookingStatus.DEPOSIT_PAID, toStatus: 'CONFIRMED' }),
      }),
    );
  });

  it('is idempotent — a duplicate payment.completed for a CONFIRMED booking is a no-op', async () => {
    // Simulates a Moyasar webhook replay: a second finance.payment.completed
    // for the same bookingId. The first event already moved the booking to
    // CONFIRMED, so the second event must skip silently (no updateMany, no
    // status log) and never re-fire Zoom creation.
    const { prisma, getSubscriber, zoom } = buildHandler();
    prisma.booking.findFirst = jest.fn().mockResolvedValue({
      ...mockBooking,
      status: BookingStatus.CONFIRMED,
      deliveryType: DeliveryType.ONLINE,
    });

    await getSubscriber()(makeEnvelope());

    expect(prisma.booking.updateMany).not.toHaveBeenCalled();
    expect(prisma.bookingStatusLog.create).not.toHaveBeenCalled();
    expect(zoom.execute).not.toHaveBeenCalled();
  });

  it('skips a CANCELLED booking (terminal status, payment event ignored)', async () => {
    const { prisma, getSubscriber, zoom } = buildHandler();
    prisma.booking.findFirst = jest.fn().mockResolvedValue({
      ...mockBooking,
      status: BookingStatus.CANCELLED,
      deliveryType: DeliveryType.ONLINE,
    });

    await getSubscriber()(makeEnvelope());

    expect(prisma.booking.updateMany).not.toHaveBeenCalled();
    expect(prisma.bookingStatusLog.create).not.toHaveBeenCalled();
    expect(zoom.execute).not.toHaveBeenCalled();
  });

  it('skips a COMPLETED booking (terminal status, payment event ignored)', async () => {
    const { prisma, getSubscriber } = buildHandler();
    prisma.booking.findFirst = jest.fn().mockResolvedValue({ ...mockBooking, status: BookingStatus.COMPLETED });

    await getSubscriber()(makeEnvelope());

    expect(prisma.booking.updateMany).not.toHaveBeenCalled();
    expect(prisma.bookingStatusLog.create).not.toHaveBeenCalled();
  });

  it('skips an EXPIRED booking (terminal status, payment event ignored)', async () => {
    const { prisma, getSubscriber } = buildHandler();
    prisma.booking.findFirst = jest.fn().mockResolvedValue({ ...mockBooking, status: BookingStatus.EXPIRED });

    await getSubscriber()(makeEnvelope());

    expect(prisma.booking.updateMany).not.toHaveBeenCalled();
    expect(prisma.bookingStatusLog.create).not.toHaveBeenCalled();
  });

  it('skips a NO_SHOW booking (terminal status, payment event ignored)', async () => {
    const { prisma, getSubscriber } = buildHandler();
    prisma.booking.findFirst = jest.fn().mockResolvedValue({ ...mockBooking, status: BookingStatus.NO_SHOW });

    await getSubscriber()(makeEnvelope());

    expect(prisma.booking.updateMany).not.toHaveBeenCalled();
    expect(prisma.bookingStatusLog.create).not.toHaveBeenCalled();
  });

  it('opens system-context CLS for booking read and tenant CLS for update', async () => {
    const setCalls: Array<[string, unknown]> = [];
    const cls = {
      run: jest.fn(async (fn: () => Promise<unknown>) => fn()),
      set: jest.fn((k: string, v: unknown) => { setCalls.push([k, v]); }),
    };
    const { prisma, getSubscriber } = buildHandler(cls as never);
    prisma.booking.findFirst = jest.fn().mockResolvedValue({ ...mockBooking, status: BookingStatus.PENDING, organizationId: 'org-1' });

    await getSubscriber()(makeEnvelope());

    expect(setCalls.map(([k]) => k)).toEqual(
      expect.arrayContaining([SYSTEM_CONTEXT_CLS_KEY, 'tenant']),
    );
    const tenantSet = setCalls.find(([k]) => k === 'tenant');
    expect(tenantSet?.[1]).toEqual(
      expect.objectContaining({ organizationId: expect.any(String) }),
    );
  });

  describe('Zoom meeting provisioning', () => {
    it('writes a durable Zoom-create outbox event in the confirmation transaction', async () => {
      const zoom = buildZoom();
      const { prisma, getSubscriber } = buildHandler(undefined, zoom);
      prisma.booking.findFirst = jest.fn().mockResolvedValue({
        ...mockBooking,
        status: BookingStatus.AWAITING_PAYMENT,
        deliveryType: DeliveryType.ONLINE,
      });

      await getSubscriber()(makeEnvelope());

      expect(prisma.outboxEvent.upsert).toHaveBeenCalledWith({
        where: { id: expect.any(String) }, update: {},
        create: expect.objectContaining({ aggregateId: 'book-1', eventType: 'bookings.zoom.create_requested' }),
      });
      expect(zoom.execute).not.toHaveBeenCalled();
    });

    it('does NOT trigger Zoom for IN_PERSON bookings', async () => {
      const zoom = buildZoom();
      const { prisma, getSubscriber } = buildHandler(undefined, zoom);
      prisma.booking.findFirst = jest.fn().mockResolvedValue({
        ...mockBooking,
        status: BookingStatus.AWAITING_PAYMENT,
        deliveryType: DeliveryType.IN_PERSON,
      });

      await getSubscriber()(makeEnvelope());

      expect(prisma.outboxEvent.upsert).not.toHaveBeenCalled();
      expect(zoom.execute).not.toHaveBeenCalled();
    });

    it('does not call the provider inline, so an unavailable provider cannot roll back confirmation', async () => {
      const zoom = { execute: jest.fn().mockRejectedValue(new Error('Zoom API down')) };
      const { prisma, getSubscriber } = buildHandler(undefined, zoom as never);
      prisma.booking.findFirst = jest.fn().mockResolvedValue({
        ...mockBooking,
        status: BookingStatus.AWAITING_PAYMENT,
        deliveryType: DeliveryType.ONLINE,
      });

      await expect(getSubscriber()(makeEnvelope())).resolves.toBeUndefined();
      expect(prisma.booking.updateMany).toHaveBeenCalled();
      expect(prisma.outboxEvent.upsert).toHaveBeenCalled();
      expect(zoom.execute).not.toHaveBeenCalled();
    });
  });
});


describe('durable operational confirmation', () => {
  it('writes the online request once across a duplicate event and preserves money', async () => {
    const { prisma, getSubscriber, eb } = buildHandler();
    const booking = { ...mockBooking, status: BookingStatus.DEPOSIT_PAID, deliveryType: DeliveryType.ONLINE };
    prisma.booking.findFirst = jest.fn().mockResolvedValueOnce(booking).mockResolvedValueOnce({ ...booking, status: BookingStatus.CONFIRMED });
    await getSubscriber()(makeEnvelope());
    await getSubscriber()(makeEnvelope());
    expect(prisma.outboxEvent.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.outboxEvent.upsert).toHaveBeenCalledWith({
      where: { id: expect.any(String) }, update: {},
      create: expect.objectContaining({ eventType: 'bookings.zoom.create_requested', aggregateId: 'book-1', status: 'PENDING_V2', deliveryLane: 'PENDING_V2' }),
    });
    expect(prisma.booking.updateMany.mock.calls[0][0].data).toEqual({ status: BookingStatus.CONFIRMED, confirmedAt: expect.any(Date) });
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

describe('deposit balance settlement', () => {
  it.each([true, false])('preserves confirmation time and handles prior Zoom request = %s', async (exists) => {
    const { prisma, getSubscriber } = buildHandler();
    const confirmedAt = new Date('2026-01-01');
    prisma.booking.findFirst = jest.fn().mockResolvedValue({ ...mockBooking, status: BookingStatus.DEPOSIT_PAID, confirmedAt, deliveryType: DeliveryType.ONLINE });
    const rows = new Map<string, unknown>();
    const { BookingZoomCreateRequestedEvent } = await import('../events/booking-zoom-create-requested.event');
    const event = new BookingZoomCreateRequestedEvent({ organizationId: 'org', bookingId: 'book-1' });
    const prior = { id: event.eventId, status: 'PUBLISHED' };
    if (exists) rows.set(event.eventId, prior);
    prisma.outboxEvent.upsert.mockImplementation(async (args) => {
      if (!rows.has(args.where.id)) rows.set(args.where.id, args.create);
      return rows.get(args.where.id);
    });
    await getSubscriber()(makeEnvelope());
    expect(rows.size).toBe(1);
    expect(prisma.outboxEvent.upsert).toHaveBeenCalled();
    expect(prisma.booking.updateMany.mock.calls[0][0].data.confirmedAt).toEqual(confirmedAt);
    if (exists) expect(rows.get(event.eventId)).toBe(prior);
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

it.each([BookingStatus.PENDING, BookingStatus.CONFIRMED, BookingStatus.COMPLETED])('preserves marked late status %s without status log or Zoom request', async (status) => {
  const { prisma, getSubscriber } = buildHandler();
  prisma.booking.findFirst = jest.fn().mockResolvedValue({ ...mockBooking, status, deliveryType: DeliveryType.ONLINE, lateEntryRecordedAt: new Date() });
  await getSubscriber()(makeEnvelope());
  expect(prisma.booking.updateMany).not.toHaveBeenCalled();
  expect(prisma.bookingStatusLog.create).not.toHaveBeenCalled();
  expect(prisma.outboxEvent.upsert).not.toHaveBeenCalled();
});
