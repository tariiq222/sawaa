import { Test } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { BookingStatus, CancellationReason, RefundType } from '@prisma/client';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { EventBusService } from '../../../infrastructure/events';
import { GetBookingSettingsHandler } from '../get-booking-settings/get-booking-settings.handler';
import { ZoomMeetingService } from '../zoom-meeting.service';
import { RefundPaymentHandler } from '../../finance/refund-payment/refund-payment.handler';
import { CancelBookingHandler } from './cancel-booking.handler';
import { DEFAULT_ORG_ID } from '../../../common/constants';
import { ProgramCapacityService } from '../program/program-capacity.service';

type MockPrisma = {
  booking: {
    findFirst: jest.Mock;
    update: jest.Mock;
  };
  payment: { findFirst: jest.Mock };
  bookingStatusLog: { create: jest.Mock };
  coupon: { updateMany: jest.Mock };
  $transaction: jest.Mock;
};

const buildMockPrisma = (): MockPrisma => {
  const prisma: MockPrisma = {
    booking: { findFirst: jest.fn(), update: jest.fn() },
    payment: { findFirst: jest.fn() },
    bookingStatusLog: { create: jest.fn() },
    coupon: { updateMany: jest.fn() },
    $transaction: jest.fn(async (cb: (tx: MockPrisma) => Promise<unknown>) => await cb(prisma)),
  };
  return prisma;
};

describe('CancelBookingHandler', () => {
  let handler: CancelBookingHandler;
  let prisma: MockPrisma;
  let eventBus: { publish: jest.Mock };
  let settingsHandler: { execute: jest.Mock };
  let zoomMeetingService: { deleteMeeting: jest.Mock };
  let refundHandler: { createRefundRequestInTx: jest.Mock };

  const baseSettings = {
    freeCancelBeforeHours: 24,
    freeCancelRefundType: RefundType.FULL,
  };

  const baseBooking = {
    id: 'book-1',
    branchId: 'branch-1',
    clientId: 'client-1',
    employeeId: 'emp-1',
    scheduledAt: new Date(Date.now() + 48 * 3_600_000),
    status: BookingStatus.PENDING,
    zoomMeetingId: null as string | null,
    couponCode: null as string | null,
  };

  beforeEach(async () => {
    prisma = buildMockPrisma();
    eventBus = { publish: jest.fn().mockResolvedValue(undefined) };
    settingsHandler = { execute: jest.fn().mockResolvedValue(baseSettings) };
    zoomMeetingService = { deleteMeeting: jest.fn().mockResolvedValue(undefined) };
    refundHandler = { createRefundRequestInTx: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        CancelBookingHandler,
        { provide: PrismaService, useValue: prisma },
        { provide: RlsTransactionService, useValue: { withTransaction: jest.fn((cb: any) => cb(prisma)) } },
        { provide: EventBusService, useValue: eventBus },
        { provide: GetBookingSettingsHandler, useValue: settingsHandler },
        { provide: ZoomMeetingService, useValue: zoomMeetingService },
        { provide: RefundPaymentHandler, useValue: refundHandler },
        { provide: ProgramCapacityService, useValue: { decrementEnrollment: jest.fn().mockResolvedValue(undefined) } },
      ],
    }).compile();

    handler = moduleRef.get(CancelBookingHandler);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validation errors', () => {
    it('throws NotFoundException when booking is not found', async () => {
      prisma.booking.findFirst.mockResolvedValue(null);

      await expect(
        handler.execute({
          bookingId: 'book-1',
          reason: CancellationReason.OTHER,
          changedBy: 'user-1',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when client source has mismatched clientId', async () => {
      prisma.booking.findFirst.mockResolvedValue(baseBooking);

      await expect(
        handler.execute({
          bookingId: 'book-1',
          reason: CancellationReason.OTHER,
          changedBy: 'user-1',
          source: 'client',
          clientId: 'wrong-client',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException when booking status is not cancellable', async () => {
      prisma.booking.findFirst.mockResolvedValue({
        ...baseBooking,
        status: BookingStatus.COMPLETED,
      });

      await expect(
        handler.execute({
          bookingId: 'book-1',
          reason: CancellationReason.OTHER,
          changedBy: 'user-1',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when client source and requireCancelApproval is true', async () => {
      prisma.booking.findFirst.mockResolvedValue(baseBooking);
      settingsHandler.execute.mockResolvedValue({
        ...baseSettings,
        requireCancelApproval: true,
      });

      await expect(
        handler.execute({
          bookingId: 'book-1',
          reason: CancellationReason.OTHER,
          changedBy: 'user-1',
          source: 'client',
          clientId: 'client-1',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('client source + requireCancelApproval=false', () => {
    it('proceeds when client cancels and approval is not required', async () => {
      prisma.booking.findFirst.mockResolvedValue(baseBooking);
      prisma.booking.update.mockResolvedValue({
        ...baseBooking,
        status: BookingStatus.CANCELLED,
      });
      settingsHandler.execute.mockResolvedValue({
        ...baseSettings,
        requireCancelApproval: false,
      });

      const result = await handler.execute({
        bookingId: 'book-1',
        reason: CancellationReason.CLIENT_REQUESTED,
        changedBy: 'user-1',
        source: 'client',
        clientId: 'client-1',
      });

      expect(result.status).toBe(BookingStatus.CANCELLED);
      expect(prisma.booking.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: BookingStatus.CANCELLED }),
        }),
      );
    });
  });

  describe('refund type calculation', () => {
    it('returns NONE when hoursUntilBooking < freeCancelBeforeHours', async () => {
      const in10h = new Date(Date.now() + 10 * 3_600_000);
      prisma.booking.findFirst.mockResolvedValue({
        ...baseBooking,
        scheduledAt: in10h,
      });
      prisma.booking.update.mockResolvedValue({
        ...baseBooking,
        scheduledAt: in10h,
        status: BookingStatus.CANCELLED,
      });

      const result = await handler.execute({
        bookingId: 'book-1',
        reason: CancellationReason.CLIENT_REQUESTED,
        changedBy: 'user-1',
      });

      expect(result.refundType).toBe(RefundType.NONE);
    });

    it('returns freeCancelRefundType when hoursUntilBooking >= freeCancelBeforeHours', async () => {
      const in48h = new Date(Date.now() + 48 * 3_600_000);
      prisma.booking.findFirst.mockResolvedValue({
        ...baseBooking,
        scheduledAt: in48h,
      });
      prisma.booking.update.mockResolvedValue({
        ...baseBooking,
        scheduledAt: in48h,
        status: BookingStatus.CANCELLED,
      });

      const result = await handler.execute({
        bookingId: 'book-1',
        reason: CancellationReason.CLIENT_REQUESTED,
        changedBy: 'user-1',
      });

      expect(result.refundType).toBe(RefundType.FULL);
    });
  });

  describe('refund request creation', () => {
    it('creates refund request when completed payment exists and refundType is not NONE', async () => {
      const in48h = new Date(Date.now() + 48 * 3_600_000);
      prisma.booking.findFirst.mockResolvedValue({
        ...baseBooking,
        scheduledAt: in48h,
      });
      prisma.payment.findFirst.mockResolvedValue({ id: 'pay-1' });
      prisma.booking.update.mockResolvedValue({
        ...baseBooking,
        scheduledAt: in48h,
        status: BookingStatus.CANCELLED,
      });
      refundHandler.createRefundRequestInTx.mockResolvedValue({
        refundRequestId: 'rr-1',
        idempotencyKey: 'ik-1',
      });

      await handler.execute({
        bookingId: 'book-1',
        reason: CancellationReason.CLIENT_REQUESTED,
        changedBy: 'user-1',
      });

      expect(refundHandler.createRefundRequestInTx).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          paymentId: 'pay-1',
          reason: expect.stringContaining('book-1'),
          performedBy: 'user-1',
        }),
      );
    });

    it('skips refund request when no completed payment exists', async () => {
      const in48h = new Date(Date.now() + 48 * 3_600_000);
      prisma.booking.findFirst.mockResolvedValue({
        ...baseBooking,
        scheduledAt: in48h,
      });
      prisma.payment.findFirst.mockResolvedValue(null);
      prisma.booking.update.mockResolvedValue({
        ...baseBooking,
        scheduledAt: in48h,
        status: BookingStatus.CANCELLED,
      });

      await handler.execute({
        bookingId: 'book-1',
        reason: CancellationReason.CLIENT_REQUESTED,
        changedBy: 'user-1',
      });

      expect(refundHandler.createRefundRequestInTx).not.toHaveBeenCalled();
    });

    it('skips refund request when refundType is NONE', async () => {
      const in10h = new Date(Date.now() + 10 * 3_600_000);
      prisma.booking.findFirst.mockResolvedValue({
        ...baseBooking,
        scheduledAt: in10h,
      });
      prisma.payment.findFirst.mockResolvedValue({ id: 'pay-1' });
      prisma.booking.update.mockResolvedValue({
        ...baseBooking,
        scheduledAt: in10h,
        status: BookingStatus.CANCELLED,
      });

      await handler.execute({
        bookingId: 'book-1',
        reason: CancellationReason.CLIENT_REQUESTED,
        changedBy: 'user-1',
      });

      expect(refundHandler.createRefundRequestInTx).not.toHaveBeenCalled();
    });
  });

  describe('refund amount — honours lateCancelRefundPercent (integer halalas)', () => {
    it('passes the FULL paid amount (amount undefined) when refundType is FULL', async () => {
      const in48h = new Date(Date.now() + 48 * 3_600_000);
      prisma.booking.findFirst.mockResolvedValue({ ...baseBooking, scheduledAt: in48h });
      settingsHandler.execute.mockResolvedValue({
        ...baseSettings,
        freeCancelRefundType: RefundType.FULL,
        lateCancelRefundPercent: 50,
      });
      prisma.payment.findFirst.mockResolvedValue({ id: 'pay-1', amount: 10_000, refundedAmount: 0 });
      prisma.booking.update.mockResolvedValue({ ...baseBooking, scheduledAt: in48h, status: BookingStatus.CANCELLED });
      refundHandler.createRefundRequestInTx.mockResolvedValue({ refundRequestId: 'rr-1', idempotencyKey: 'ik-1' });

      await handler.execute({ bookingId: 'book-1', reason: CancellationReason.CLIENT_REQUESTED, changedBy: 'user-1' });

      expect(refundHandler.createRefundRequestInTx).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ paymentId: 'pay-1', amount: undefined }),
      );
    });

    it('late cancel refunds exactly round(paid * percent / 100) — no fractional halala', async () => {
      const in10h = new Date(Date.now() + 10 * 3_600_000);
      prisma.booking.findFirst.mockResolvedValue({ ...baseBooking, scheduledAt: in10h });
      settingsHandler.execute.mockResolvedValue({
        ...baseSettings,
        freeCancelBeforeHours: 24,
        freeCancelRefundType: RefundType.FULL,
        lateCancelRefundPercent: 33, // late window → PARTIAL 33%
      });
      // 33% of 10001 = 3300.33 → 3300 exact halalas
      prisma.payment.findFirst.mockResolvedValue({ id: 'pay-1', amount: 10_001, refundedAmount: 0 });
      prisma.booking.update.mockResolvedValue({ ...baseBooking, scheduledAt: in10h, status: BookingStatus.CANCELLED });
      refundHandler.createRefundRequestInTx.mockResolvedValue({ refundRequestId: 'rr-1', idempotencyKey: 'ik-1' });

      const result = await handler.execute({ bookingId: 'book-1', reason: CancellationReason.CLIENT_REQUESTED, changedBy: 'user-1' });

      expect(result.refundType).toBe(RefundType.PARTIAL);
      const call = refundHandler.createRefundRequestInTx.mock.calls[0][1];
      expect(call.amount).toBe(3300);
      expect(Number.isInteger(call.amount)).toBe(true);
    });

    it('late cancel with 100% refunds in full via PARTIAL→FULL → amount undefined', async () => {
      const in10h = new Date(Date.now() + 10 * 3_600_000);
      prisma.booking.findFirst.mockResolvedValue({ ...baseBooking, scheduledAt: in10h });
      settingsHandler.execute.mockResolvedValue({
        ...baseSettings,
        freeCancelBeforeHours: 24,
        freeCancelRefundType: RefundType.NONE,
        lateCancelRefundPercent: 100,
      });
      prisma.payment.findFirst.mockResolvedValue({ id: 'pay-1', amount: 8_888, refundedAmount: 0 });
      prisma.booking.update.mockResolvedValue({ ...baseBooking, scheduledAt: in10h, status: BookingStatus.CANCELLED });
      refundHandler.createRefundRequestInTx.mockResolvedValue({ refundRequestId: 'rr-1', idempotencyKey: 'ik-1' });

      const result = await handler.execute({ bookingId: 'book-1', reason: CancellationReason.CLIENT_REQUESTED, changedBy: 'user-1' });

      expect(result.refundType).toBe(RefundType.FULL);
      expect(refundHandler.createRefundRequestInTx).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ amount: undefined }),
      );
    });

    it('late cancel with 0% issues NO refund request (forfeiture)', async () => {
      const in10h = new Date(Date.now() + 10 * 3_600_000);
      prisma.booking.findFirst.mockResolvedValue({ ...baseBooking, scheduledAt: in10h });
      settingsHandler.execute.mockResolvedValue({
        ...baseSettings,
        freeCancelBeforeHours: 24,
        freeCancelRefundType: RefundType.FULL,
        lateCancelRefundPercent: 0,
      });
      prisma.payment.findFirst.mockResolvedValue({ id: 'pay-1', amount: 10_000, refundedAmount: 0 });
      prisma.booking.update.mockResolvedValue({ ...baseBooking, scheduledAt: in10h, status: BookingStatus.CANCELLED });

      const result = await handler.execute({ bookingId: 'book-1', reason: CancellationReason.CLIENT_REQUESTED, changedBy: 'user-1' });

      expect(result.refundType).toBe(RefundType.NONE);
      expect(refundHandler.createRefundRequestInTx).not.toHaveBeenCalled();
    });
  });

  describe('coupon handling', () => {
    it('decrements coupon usedCount when booking has a couponCode', async () => {
      prisma.booking.findFirst.mockResolvedValue({
        ...baseBooking,
        couponCode: 'PROMO10',
      });
      prisma.booking.update.mockResolvedValue({
        ...baseBooking,
        couponCode: 'PROMO10',
        status: BookingStatus.CANCELLED,
      });

      await handler.execute({
        bookingId: 'book-1',
        reason: CancellationReason.CLIENT_REQUESTED,
        changedBy: 'user-1',
      });

      expect(prisma.coupon.updateMany).toHaveBeenCalledWith({
        where: { code: 'PROMO10', usedCount: { gt: 0 } },
        data: { usedCount: { decrement: 1 } },
      });
    });

    it('skips coupon decrement when booking has no couponCode', async () => {
      prisma.booking.findFirst.mockResolvedValue(baseBooking);
      prisma.booking.update.mockResolvedValue({
        ...baseBooking,
        status: BookingStatus.CANCELLED,
      });

      await handler.execute({
        bookingId: 'book-1',
        reason: CancellationReason.CLIENT_REQUESTED,
        changedBy: 'user-1',
      });

      expect(prisma.coupon.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('zoom meeting cleanup', () => {
    it('calls deleteMeeting when booking has zoomMeetingId', async () => {
      prisma.booking.findFirst.mockResolvedValue({
        ...baseBooking,
        zoomMeetingId: 'zoom-1',
      });
      prisma.booking.update.mockResolvedValue({
        ...baseBooking,
        zoomMeetingId: 'zoom-1',
        status: BookingStatus.CANCELLED,
      });

      await handler.execute({
        bookingId: 'book-1',
        reason: CancellationReason.CLIENT_REQUESTED,
        changedBy: 'user-1',
      });

      expect(zoomMeetingService.deleteMeeting).toHaveBeenCalledWith(
        DEFAULT_ORG_ID,
        'zoom-1',
      );
    });

    it('handles deleteMeeting rejection gracefully', async () => {
      prisma.booking.findFirst.mockResolvedValue({
        ...baseBooking,
        zoomMeetingId: 'zoom-1',
      });
      prisma.booking.update.mockResolvedValue({
        ...baseBooking,
        zoomMeetingId: 'zoom-1',
        status: BookingStatus.CANCELLED,
      });
      zoomMeetingService.deleteMeeting.mockRejectedValue(new Error('Zoom error'));

      await expect(
        handler.execute({
          bookingId: 'book-1',
          reason: CancellationReason.CLIENT_REQUESTED,
          changedBy: 'user-1',
        }),
      ).resolves.toBeDefined();
    });

    it('skips deleteMeeting when booking has no zoomMeetingId', async () => {
      prisma.booking.findFirst.mockResolvedValue(baseBooking);
      prisma.booking.update.mockResolvedValue({
        ...baseBooking,
        status: BookingStatus.CANCELLED,
      });

      await handler.execute({
        bookingId: 'book-1',
        reason: CancellationReason.CLIENT_REQUESTED,
        changedBy: 'user-1',
      });

      expect(zoomMeetingService.deleteMeeting).not.toHaveBeenCalled();
    });
  });

  describe('side effects', () => {
    it('creates a BookingStatusLog entry', async () => {
      prisma.booking.findFirst.mockResolvedValue(baseBooking);
      prisma.booking.update.mockResolvedValue({
        ...baseBooking,
        status: BookingStatus.CANCELLED,
      });

      await handler.execute({
        bookingId: 'book-1',
        reason: CancellationReason.CLIENT_REQUESTED,
        changedBy: 'user-1',
      });

      expect(prisma.bookingStatusLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          bookingId: 'book-1',
          fromStatus: BookingStatus.PENDING,
          toStatus: BookingStatus.CANCELLED,
          changedBy: 'user-1',
          reason: CancellationReason.CLIENT_REQUESTED,
        }),
      });
    });

    it('publishes BookingCancelledEvent with correct payload', async () => {
      const in48h = new Date(Date.now() + 48 * 3_600_000);
      prisma.booking.findFirst.mockResolvedValue({
        ...baseBooking,
        scheduledAt: in48h,
      });
      prisma.payment.findFirst.mockResolvedValue({ id: 'pay-1' });
      prisma.booking.update.mockResolvedValue({
        ...baseBooking,
        scheduledAt: in48h,
        status: BookingStatus.CANCELLED,
      });
      refundHandler.createRefundRequestInTx.mockResolvedValue({
        refundRequestId: 'rr-1',
        idempotencyKey: 'ik-1',
      });

      await handler.execute({
        bookingId: 'book-1',
        reason: CancellationReason.CLIENT_REQUESTED,
        changedBy: 'user-1',
        cancelNotes: 'Test notes',
      });

      expect(eventBus.publish).toHaveBeenCalledWith(
        'bookings.booking.cancelled',
        expect.objectContaining({
          source: 'bookings',
          version: 1,
          payload: expect.objectContaining({
            organizationId: DEFAULT_ORG_ID,
            bookingId: 'book-1',
            clientId: 'client-1',
            employeeId: 'emp-1',
            reason: CancellationReason.CLIENT_REQUESTED,
            cancelNotes: 'Test notes',
            refundType: RefundType.FULL,
            paymentId: 'pay-1',
            refundRequestId: 'rr-1',
            idempotencyKey: 'ik-1',
          }),
        }),
      );
    });

    it('sets zoomMeetingStatus to CANCELLED in transaction when zoomMeetingId exists', async () => {
      prisma.booking.findFirst.mockResolvedValue({
        ...baseBooking,
        zoomMeetingId: 'zoom-1',
      });
      prisma.booking.update.mockResolvedValue({
        ...baseBooking,
        zoomMeetingId: 'zoom-1',
        status: BookingStatus.CANCELLED,
      });

      await handler.execute({
        bookingId: 'book-1',
        reason: CancellationReason.CLIENT_REQUESTED,
        changedBy: 'user-1',
      });

      expect(prisma.booking.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            zoomMeetingStatus: 'CANCELLED',
          }),
        }),
      );
    });

    it('does not set zoomMeetingStatus when zoomMeetingId is absent', async () => {
      prisma.booking.findFirst.mockResolvedValue(baseBooking);
      prisma.booking.update.mockResolvedValue({
        ...baseBooking,
        status: BookingStatus.CANCELLED,
      });

      await handler.execute({
        bookingId: 'book-1',
        reason: CancellationReason.CLIENT_REQUESTED,
        changedBy: 'user-1',
      });

      expect(prisma.booking.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.not.objectContaining({
            zoomMeetingStatus: expect.anything(),
          }),
        }),
      );
    });
  });
});
