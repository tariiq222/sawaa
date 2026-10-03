import { NotFoundException, BadRequestException } from '@nestjs/common';
import { BookingStatus, DeliveryType } from '@prisma/client';
import { ApproveCancelBookingHandler } from './approve-cancel-booking.handler';
import { buildPrisma as buildBasePrisma, buildRlsTransaction, buildEventBus, mockBooking } from '../testing/booking-test-helpers';

const buildPrisma = () => {
  const p = buildBasePrisma();
  const raw = p.$queryRaw.getMockImplementation()!;
  p.$queryRaw.mockImplementation((query: any, ...values: any[]) => Array.isArray(query) ? raw(query, ...values) : raw(query.strings, ...query.values));
  Object.assign(p.payment, { findMany: jest.fn().mockResolvedValue([]) });
  return p;
};

const buildGroupCapacity = () => ({ recalculateGroupStatus: jest.fn().mockResolvedValue(undefined) });

const buildRefundHandler = () => ({
  createRefundRequestInTx: jest.fn().mockResolvedValue({
    refundRequestId: 'rr-1',
    idempotencyKey: 'ik-1',
    payment: { id: 'pay-1', gatewayRef: 'gw-1', amount: 10000, invoice: { id: 'inv-1', bookingId: 'book-1', clientId: 'client-1', currency: 'SAR' } },
  }),
});

const cancelRequestedBooking = {
  ...mockBooking,
  status: 'CANCEL_REQUESTED' as BookingStatus,
  branchId: 'branch-1',
  clientId: 'client-1',
  employeeId: 'emp-1',
};

const defaultSettings = {
  execute: jest.fn().mockResolvedValue({ autoRefundOnCancel: true }),
};

const buildHandler = (prisma: ReturnType<typeof buildPrisma>, overrides: {
  rls?: ReturnType<typeof buildRlsTransaction>;
  eb?: ReturnType<typeof buildEventBus>;
  settings?: typeof defaultSettings;
  groupCapacity?: ReturnType<typeof buildGroupCapacity>;
  refundHandler?: ReturnType<typeof buildRefundHandler>;
} = {}) => new ApproveCancelBookingHandler(
  prisma as never,
  (overrides.rls ?? buildRlsTransaction(prisma)) as never,
  (overrides.eb ?? buildEventBus()) as never,
  (overrides.settings ?? defaultSettings) as never,
  (overrides.groupCapacity ?? buildGroupCapacity()) as never,
  (overrides.refundHandler ?? buildRefundHandler()) as never,
);

describe('ApproveCancelBookingHandler', () => {
  it('approves cancel request and sets status to CANCELLED', async () => {
    const prisma = buildPrisma();
    prisma.booking.findFirst = jest.fn().mockResolvedValue(cancelRequestedBooking);
    prisma.booking.update = jest.fn().mockResolvedValue({ ...cancelRequestedBooking, status: BookingStatus.CANCELLED });
    const eb = buildEventBus();
    const handler = buildHandler(prisma, { eb });

    const result = await handler.execute({
      bookingId: 'book-1',
      approvedBy: 'admin-1',
      approverNotes: 'Approved',
    });

    expect(prisma.booking.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: BookingStatus.CANCELLED }) }),
    );
    expect(prisma.outboxEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ eventType: 'bookings.booking.cancel_approved' }),
    });
    expect(eb.publish).not.toHaveBeenCalled();
    expect(result.autoRefund).toBe(true);
  });

  it('fences approval against an active ONLINE reschedule sync lease', async () => {
    const prisma = buildPrisma();
    prisma.booking.findFirst = jest.fn().mockResolvedValue({ ...cancelRequestedBooking, deliveryType: DeliveryType.ONLINE });
    const handler = buildHandler(prisma);
    await handler.execute({ bookingId: 'book-1', approvedBy: 'admin-1' });
    expect(prisma.booking.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        AND: expect.arrayContaining([expect.objectContaining({
          OR: expect.arrayContaining([expect.objectContaining({ zoomSyncLeaseOwner: null })]),
        })]),
      }),
    }));
  });

  it('fails approval atomically when the active sync lease makes its booking CAS lose', async () => {
    const prisma = buildPrisma();
    prisma.booking.findFirst = jest.fn().mockResolvedValue({ ...cancelRequestedBooking, deliveryType: DeliveryType.ONLINE });
    prisma.booking.updateMany.mockResolvedValue({ count: 0 });
    const handler = buildHandler(prisma);
    await expect(handler.execute({ bookingId: 'book-1', approvedBy: 'admin-1' })).rejects.toThrow('status changed concurrently');
    expect(prisma.bookingStatusLog.create).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when booking not found', async () => {
    const prisma = buildPrisma();
    prisma.booking.findFirst = jest.fn().mockResolvedValue(null);
    const handler = buildHandler(prisma);

    await expect(
      handler.execute({ bookingId: 'bad', approvedBy: 'admin-1' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws BadRequestException when status is not CANCEL_REQUESTED', async () => {
    const prisma = buildPrisma();
    prisma.booking.findFirst = jest.fn().mockResolvedValue({ ...mockBooking, status: BookingStatus.CONFIRMED });
    const handler = buildHandler(prisma);

    await expect(
      handler.execute({ bookingId: 'book-1', approvedBy: 'admin-1' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('writes BookingStatusLog entry on approval', async () => {
    const prisma = buildPrisma();
    prisma.booking.findFirst = jest.fn().mockResolvedValue(cancelRequestedBooking);
    prisma.booking.update = jest.fn().mockResolvedValue({ ...cancelRequestedBooking, status: BookingStatus.CANCELLED });
    const handler = buildHandler(prisma);

    await handler.execute({ bookingId: 'book-1', approvedBy: 'admin-1', approverNotes: 'ok' });

    expect(prisma.bookingStatusLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          fromStatus: 'CANCEL_REQUESTED',
          toStatus: BookingStatus.CANCELLED,
          changedBy: 'admin-1',
        }),
      }),
    );
  });

  it('propagates PARTIAL refund decision into event payload and status log reason', async () => {
    const prisma = buildPrisma();
    prisma.booking.findFirst = jest.fn().mockResolvedValue(cancelRequestedBooking);
    prisma.booking.update = jest.fn().mockResolvedValue({ ...cancelRequestedBooking, status: BookingStatus.CANCELLED });
    Object.assign(prisma.payment, { findMany: jest.fn().mockResolvedValue([{ id: 'pay-1', invoiceId: 'inv-1', amount: 10000, refundedAmount: 0, currency: 'SAR', status: 'COMPLETED', method: 'CASH', gatewayRef: null, refundRequests: [] }]) });
    const eb = buildEventBus();
    const handler = buildHandler(prisma, { eb });

    await handler.execute({
      bookingId: 'book-1',
      approvedBy: 'admin-1',
      approverNotes: 'client travelled',
      refundType: 'PARTIAL',
      refundAmount: 5000,
    });

    expect(prisma.outboxEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventType: 'bookings.booking.cancel_approved',
        payload: expect.objectContaining({
          payload: expect.objectContaining({
          refundType: 'PARTIAL',
          refundAmount: 5000,
          approverNotes: 'client travelled',
          }),
        }),
      }),
    });
    expect(prisma.bookingStatusLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          reason: 'Cancel request approved — refund: PARTIAL 5000 halalas — client travelled',
        }),
      }),
    );
  });

  it('propagates FULL refund decision without amount into event and status log', async () => {
    const prisma = buildPrisma();
    prisma.booking.findFirst = jest.fn().mockResolvedValue(cancelRequestedBooking);
    prisma.booking.update = jest.fn().mockResolvedValue({ ...cancelRequestedBooking, status: BookingStatus.CANCELLED });
    const eb = buildEventBus();
    const handler = buildHandler(prisma, { eb });

    await handler.execute({ bookingId: 'book-1', approvedBy: 'admin-1', refundType: 'FULL' });

    expect(prisma.outboxEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        payload: expect.objectContaining({
          payload: expect.objectContaining({ refundType: 'FULL', refundAmount: undefined }),
        }),
      }),
    });
    expect(prisma.bookingStatusLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ reason: 'Cancel request approved — refund: FULL' }),
      }),
    );
  });

  it('omits refund decision from event and status log when not provided', async () => {
    const prisma = buildPrisma();
    prisma.booking.findFirst = jest.fn().mockResolvedValue(cancelRequestedBooking);
    prisma.booking.update = jest.fn().mockResolvedValue({ ...cancelRequestedBooking, status: BookingStatus.CANCELLED });
    const eb = buildEventBus();
    const handler = buildHandler(prisma, { eb });

    await handler.execute({ bookingId: 'book-1', approvedBy: 'admin-1' });

    expect(prisma.outboxEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        payload: expect.objectContaining({
          payload: expect.objectContaining({ refundType: undefined, refundAmount: undefined }),
        }),
      }),
    });
    expect(prisma.bookingStatusLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ reason: 'Cancel request approved' }),
      }),
    );
  });

  it('throws BadRequestException when refundType is PARTIAL without refundAmount', async () => {
    const prisma = buildPrisma();
    const handler = buildHandler(prisma);

    await expect(
      handler.execute({ bookingId: 'book-1', approvedBy: 'admin-1', refundType: 'PARTIAL' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when refundAmount is provided without PARTIAL refundType', async () => {
    const prisma = buildPrisma();
    const handler = buildHandler(prisma);

    await expect(
      handler.execute({ bookingId: 'book-1', approvedBy: 'admin-1', refundType: 'FULL', refundAmount: 5000 }),
    ).rejects.toThrow(BadRequestException);
  });

  it('defaults autoRefund to true when setting not present', async () => {
    const prisma = buildPrisma();
    prisma.booking.findFirst = jest.fn().mockResolvedValue(cancelRequestedBooking);
    prisma.booking.update = jest.fn().mockResolvedValue({ ...cancelRequestedBooking, status: BookingStatus.CANCELLED });
    const settingsNoRefund = { execute: jest.fn().mockResolvedValue({}) };
    const handler = buildHandler(prisma, { settings: settingsNoRefund });

    const result = await handler.execute({ bookingId: 'book-1', approvedBy: 'admin-1' });
    expect(result.autoRefund).toBe(true);
  });

  it.each([true, false])('defaults refund budget from autoRefund=%s', async autoRefund => {
    const prisma = buildPrisma();
    prisma.booking.findFirst.mockResolvedValue(cancelRequestedBooking);
    Object.assign(prisma.payment, { findMany: jest.fn().mockResolvedValue([{
      id: 'pay-1', invoiceId: 'inv-1', amount: 10000, refundedAmount: 0,
      currency: 'SAR', status: 'COMPLETED', method: 'CASH', gatewayRef: null, refundRequests: [],
    }]) });
    const refundHandler = buildRefundHandler();
    const handler = buildHandler(prisma, { refundHandler, settings: { execute: jest.fn().mockResolvedValue({ autoRefundOnCancel: autoRefund }) } });
    await handler.execute({ bookingId: 'book-1', approvedBy: 'admin-1' });
    expect(prisma.outboxEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      payload: expect.objectContaining({ payload: expect.objectContaining({
        staffCancellation: expect.objectContaining({ refund: expect.objectContaining({ refundAmount: autoRefund ? 10000 : 0 }) }),
      }) }),
    }) });
    expect(refundHandler.createRefundRequestInTx).not.toHaveBeenCalled();
  });

  // ─── Session-package credit return (P1-1 fix) ───────────────────────────

  it('returns session-package credit on cancel-approval of a credit booking', async () => {
    const creditBooking = { ...cancelRequestedBooking, packageCreditId: 'credit-1' };
    const prisma = buildPrisma();
    prisma.booking.findFirst = jest.fn().mockResolvedValue(creditBooking);
    prisma.booking.update = jest.fn().mockResolvedValue({ ...creditBooking, status: BookingStatus.CANCELLED });
    const handler = buildHandler(prisma);

    await handler.execute({ bookingId: 'book-1', approvedBy: 'admin-1' });

    expect(prisma.packageCreditUsage.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'usage-1' },
        data: expect.objectContaining({ status: 'RETURNED' }),
      }),
    );
    expect(prisma.packageCredit.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'credit-1' },
        data: expect.objectContaining({ usedQuantity: { decrement: 1 } }),
      }),
    );
  });

  it('does NOT call returnPackageCreditForBooking when booking has no packageCreditId', async () => {
    const prisma = buildPrisma();
    prisma.booking.findFirst = jest.fn().mockResolvedValue(cancelRequestedBooking); // no packageCreditId
    prisma.booking.update = jest.fn().mockResolvedValue({ ...cancelRequestedBooking, status: BookingStatus.CANCELLED });
    const handler = buildHandler(prisma);

    await handler.execute({ bookingId: 'book-1', approvedBy: 'admin-1' });

    expect(prisma.packageCreditUsage.update).not.toHaveBeenCalled();
    expect(prisma.packageCredit.update).not.toHaveBeenCalled();
  });
});
