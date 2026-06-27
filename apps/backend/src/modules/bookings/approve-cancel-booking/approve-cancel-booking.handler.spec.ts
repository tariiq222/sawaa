import { NotFoundException, BadRequestException } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { ApproveCancelBookingHandler } from './approve-cancel-booking.handler';
import { buildPrisma, buildRlsTransaction, buildEventBus, mockBooking } from '../testing/booking-test-helpers';

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
    expect(eb.publish).toHaveBeenCalledWith('bookings.booking.cancel_approved', expect.anything());
    expect(result.autoRefund).toBe(true);
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
    const eb = buildEventBus();
    const handler = buildHandler(prisma, { eb });

    await handler.execute({
      bookingId: 'book-1',
      approvedBy: 'admin-1',
      approverNotes: 'client travelled',
      refundType: 'PARTIAL',
      refundAmount: 5000,
    });

    expect(eb.publish).toHaveBeenCalledWith(
      'bookings.booking.cancel_approved',
      expect.objectContaining({
        payload: expect.objectContaining({
          refundType: 'PARTIAL',
          refundAmount: 5000,
          approverNotes: 'client travelled',
        }),
      }),
    );
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

    expect(eb.publish).toHaveBeenCalledWith(
      'bookings.booking.cancel_approved',
      expect.objectContaining({
        payload: expect.objectContaining({ refundType: 'FULL', refundAmount: undefined }),
      }),
    );
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

    expect(eb.publish).toHaveBeenCalledWith(
      'bookings.booking.cancel_approved',
      expect.objectContaining({
        payload: expect.objectContaining({ refundType: undefined, refundAmount: undefined }),
      }),
    );
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

  // ─── Refund execution tests (Fix #5) ─────────────────────────────────────

  it('creates refund request in transaction when booking is PAID and refundType is FULL', async () => {
    const prisma = buildPrisma();
    prisma.booking.findFirst = jest.fn().mockResolvedValue(cancelRequestedBooking);
    prisma.booking.update = jest.fn().mockResolvedValue({ ...cancelRequestedBooking, status: BookingStatus.CANCELLED });
    // Simulate a completed payment found before the transaction
    prisma.payment.findFirst = jest.fn().mockResolvedValue({ id: 'pay-1', amount: 10000 });
    const refundHandler = buildRefundHandler();
    const handler = buildHandler(prisma, { refundHandler });

    await handler.execute({ bookingId: 'book-1', approvedBy: 'admin-1', refundType: 'FULL' });

    expect(refundHandler.createRefundRequestInTx).toHaveBeenCalledWith(
      expect.anything(), // tx
      expect.objectContaining({
        paymentId: 'pay-1',
        amount: undefined, // FULL refund — amount left undefined so finance handler refunds the whole amount
        performedBy: 'admin-1',
      }),
    );
  });

  it('creates partial refund request in transaction when refundType is PARTIAL', async () => {
    const prisma = buildPrisma();
    prisma.booking.findFirst = jest.fn().mockResolvedValue(cancelRequestedBooking);
    prisma.booking.update = jest.fn().mockResolvedValue({ ...cancelRequestedBooking, status: BookingStatus.CANCELLED });
    prisma.payment.findFirst = jest.fn().mockResolvedValue({ id: 'pay-1', amount: 10000 });
    const refundHandler = buildRefundHandler();
    const handler = buildHandler(prisma, { refundHandler });

    await handler.execute({ bookingId: 'book-1', approvedBy: 'admin-1', refundType: 'PARTIAL', refundAmount: 5000 });

    expect(refundHandler.createRefundRequestInTx).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ paymentId: 'pay-1', amount: 5000, performedBy: 'admin-1' }),
    );
  });

  it('does NOT create refund request when refundType is NONE', async () => {
    const prisma = buildPrisma();
    prisma.booking.findFirst = jest.fn().mockResolvedValue(cancelRequestedBooking);
    prisma.booking.update = jest.fn().mockResolvedValue({ ...cancelRequestedBooking, status: BookingStatus.CANCELLED });
    prisma.payment.findFirst = jest.fn().mockResolvedValue({ id: 'pay-1', amount: 10000 });
    const refundHandler = buildRefundHandler();
    const handler = buildHandler(prisma, { refundHandler });

    await handler.execute({ bookingId: 'book-1', approvedBy: 'admin-1', refundType: 'NONE' });

    expect(refundHandler.createRefundRequestInTx).not.toHaveBeenCalled();
  });

  it('does NOT create refund request when booking was never paid', async () => {
    const prisma = buildPrisma();
    prisma.booking.findFirst = jest.fn().mockResolvedValue(cancelRequestedBooking);
    prisma.booking.update = jest.fn().mockResolvedValue({ ...cancelRequestedBooking, status: BookingStatus.CANCELLED });
    // No completed payment
    prisma.payment.findFirst = jest.fn().mockResolvedValue(null);
    const refundHandler = buildRefundHandler();
    const handler = buildHandler(prisma, { refundHandler });

    await handler.execute({ bookingId: 'book-1', approvedBy: 'admin-1', refundType: 'FULL' });

    expect(refundHandler.createRefundRequestInTx).not.toHaveBeenCalled();
  });

  it('auto-issues FULL refund when no refundType given and autoRefund is true and booking is PAID', async () => {
    const prisma = buildPrisma();
    prisma.booking.findFirst = jest.fn().mockResolvedValue(cancelRequestedBooking);
    prisma.booking.update = jest.fn().mockResolvedValue({ ...cancelRequestedBooking, status: BookingStatus.CANCELLED });
    prisma.payment.findFirst = jest.fn().mockResolvedValue({ id: 'pay-1', amount: 10000 });
    const refundHandler = buildRefundHandler();
    const settings = { execute: jest.fn().mockResolvedValue({ autoRefundOnCancel: true }) };
    const handler = buildHandler(prisma, { refundHandler, settings });

    // No refundType provided — handler defaults to FULL when autoRefund=true
    await handler.execute({ bookingId: 'book-1', approvedBy: 'admin-1' });

    expect(refundHandler.createRefundRequestInTx).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ paymentId: 'pay-1', amount: undefined }),
    );
  });

  it('does NOT auto-issue refund when no refundType given and autoRefund is false', async () => {
    const prisma = buildPrisma();
    prisma.booking.findFirst = jest.fn().mockResolvedValue(cancelRequestedBooking);
    prisma.booking.update = jest.fn().mockResolvedValue({ ...cancelRequestedBooking, status: BookingStatus.CANCELLED });
    prisma.payment.findFirst = jest.fn().mockResolvedValue({ id: 'pay-1', amount: 10000 });
    const refundHandler = buildRefundHandler();
    const settings = { execute: jest.fn().mockResolvedValue({ autoRefundOnCancel: false }) };
    const handler = buildHandler(prisma, { refundHandler, settings });

    await handler.execute({ bookingId: 'book-1', approvedBy: 'admin-1' });

    expect(refundHandler.createRefundRequestInTx).not.toHaveBeenCalled();
  });

  it('includes refundRequestId and paymentId in the published event', async () => {
    const prisma = buildPrisma();
    prisma.booking.findFirst = jest.fn().mockResolvedValue(cancelRequestedBooking);
    prisma.booking.update = jest.fn().mockResolvedValue({ ...cancelRequestedBooking, status: BookingStatus.CANCELLED });
    prisma.payment.findFirst = jest.fn().mockResolvedValue({ id: 'pay-1', amount: 10000 });
    const refundHandler = buildRefundHandler();
    const eb = buildEventBus();
    const handler = buildHandler(prisma, { refundHandler, eb });

    await handler.execute({ bookingId: 'book-1', approvedBy: 'admin-1', refundType: 'FULL' });

    expect(eb.publish).toHaveBeenCalledWith(
      'bookings.booking.cancel_approved',
      expect.objectContaining({
        payload: expect.objectContaining({
          paymentId: 'pay-1',
          refundRequestId: 'rr-1',
          idempotencyKey: 'ik-1',
        }),
      }),
    );
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
