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
  const prisma = buildPrisma();
  const eb = {
    subscribe: jest.fn(),
    publish: jest.fn().mockResolvedValue(undefined),
  };
  let subscriber: ((envelope: { payload: { bookingId: string; paymentId: string; invoiceId: string } }) => Promise<void>) | null = null;
  eb.subscribe = jest.fn((_, cb) => { subscriber = cb as typeof subscriber; });
  const cls = clsOverride ?? buildCls();
  const zoom = zoomOverride ?? buildZoom();
  const handler = new PaymentCompletedEventHandler(prisma as never, buildRlsTransaction(prisma) as never, eb as never, cls as never, zoom as never);
  handler.register();
  return { prisma, eb, handler, cls, zoom, getSubscriber: () => subscriber! };
}

const makeEnvelope = (overrides: Partial<{ bookingId: string; paymentId: string; invoiceId: string }> = {}) => ({
  payload: { bookingId: 'book-1', paymentId: 'pay-1', invoiceId: 'inv-1', ...overrides },
});

describe('PaymentCompletedEventHandler', () => {
  it('registers a subscriber on finance.payment.completed', () => {
    const { eb } = buildHandler();
    expect(eb.subscribe).toHaveBeenCalledWith('finance.payment.completed', expect.any(Function));
  });

  it('confirms PENDING booking on payment completed', async () => {
    const { prisma, getSubscriber } = buildHandler();
    prisma.booking.findFirst = jest.fn().mockResolvedValue({ ...mockBooking, status: BookingStatus.PENDING });
    prisma.booking.update = jest.fn().mockResolvedValue({ ...mockBooking, status: BookingStatus.CONFIRMED });

    await getSubscriber()(makeEnvelope());

    expect(prisma.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'CONFIRMED' }) }),
    );
  });

  it('confirms AWAITING_PAYMENT booking on payment completed', async () => {
    const { prisma, getSubscriber } = buildHandler();
    prisma.booking.findFirst = jest.fn().mockResolvedValue({ ...mockBooking, status: BookingStatus.AWAITING_PAYMENT });
    prisma.booking.update = jest.fn().mockResolvedValue({ ...mockBooking, status: BookingStatus.CONFIRMED });

    await getSubscriber()(makeEnvelope());

    expect(prisma.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'CONFIRMED' }) }),
    );
  });

  it('skips non-PENDING / non-AWAITING_PAYMENT bookings', async () => {
    const { prisma, getSubscriber } = buildHandler();
    prisma.booking.findFirst = jest.fn().mockResolvedValue({ ...mockBooking, status: BookingStatus.CONFIRMED });

    await getSubscriber()(makeEnvelope());

    expect(prisma.booking.update).not.toHaveBeenCalled();
  });

  it('skips when booking not found', async () => {
    const { prisma, getSubscriber } = buildHandler();
    prisma.booking.findFirst = jest.fn().mockResolvedValue(null);

    await getSubscriber()(makeEnvelope());

    expect(prisma.booking.update).not.toHaveBeenCalled();
  });

  it('writes BookingStatusLog on confirmation', async () => {
    const { prisma, getSubscriber } = buildHandler();
    prisma.booking.findFirst = jest.fn().mockResolvedValue({ ...mockBooking, status: BookingStatus.PENDING });
    prisma.booking.update = jest.fn().mockResolvedValue({ ...mockBooking, status: BookingStatus.CONFIRMED });

    await getSubscriber()(makeEnvelope());

    expect(prisma.bookingStatusLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ fromStatus: BookingStatus.PENDING, toStatus: 'CONFIRMED' }),
      }),
    );
  });

  it('opens system-context CLS for booking read and tenant CLS for update', async () => {
    const setCalls: Array<[string, unknown]> = [];
    const cls = {
      run: jest.fn(async (fn: () => Promise<unknown>) => fn()),
      set: jest.fn((k: string, v: unknown) => { setCalls.push([k, v]); }),
    };
    const { prisma, getSubscriber } = buildHandler(cls as never);
    prisma.booking.findFirst = jest.fn().mockResolvedValue({ ...mockBooking, status: BookingStatus.PENDING, organizationId: 'org-1' });
    prisma.booking.update = jest.fn().mockResolvedValue({ ...mockBooking, status: BookingStatus.CONFIRMED, organizationId: 'org-1' });

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
    it('triggers Zoom meeting creation for ONLINE bookings after confirmation', async () => {
      const zoom = buildZoom();
      const { prisma, getSubscriber } = buildHandler(undefined, zoom);
      prisma.booking.findFirst = jest.fn().mockResolvedValue({
        ...mockBooking,
        status: BookingStatus.AWAITING_PAYMENT,
        deliveryType: DeliveryType.ONLINE,
      });
      prisma.booking.update = jest.fn().mockResolvedValue({ ...mockBooking, status: BookingStatus.CONFIRMED });

      await getSubscriber()(makeEnvelope());

      expect(zoom.execute).toHaveBeenCalledWith({ bookingId: 'book-1' });
    });

    it('does NOT trigger Zoom for IN_PERSON bookings', async () => {
      const zoom = buildZoom();
      const { prisma, getSubscriber } = buildHandler(undefined, zoom);
      prisma.booking.findFirst = jest.fn().mockResolvedValue({
        ...mockBooking,
        status: BookingStatus.AWAITING_PAYMENT,
        deliveryType: DeliveryType.IN_PERSON,
      });
      prisma.booking.update = jest.fn().mockResolvedValue({ ...mockBooking, status: BookingStatus.CONFIRMED });

      await getSubscriber()(makeEnvelope());

      expect(zoom.execute).not.toHaveBeenCalled();
    });

    it('does not fail the payment confirmation when Zoom creation throws (best-effort)', async () => {
      const zoom = { execute: jest.fn().mockRejectedValue(new Error('Zoom API down')) };
      const { prisma, getSubscriber } = buildHandler(undefined, zoom as never);
      prisma.booking.findFirst = jest.fn().mockResolvedValue({
        ...mockBooking,
        status: BookingStatus.AWAITING_PAYMENT,
        deliveryType: DeliveryType.ONLINE,
      });
      prisma.booking.update = jest.fn().mockResolvedValue({ ...mockBooking, status: BookingStatus.CONFIRMED });

      await expect(getSubscriber()(makeEnvelope())).resolves.toBeUndefined();
      expect(prisma.booking.update).toHaveBeenCalled();
    });
  });
});
