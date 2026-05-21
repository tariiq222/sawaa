import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { BookingStatus, CancellationReason } from '@prisma/client';
import { CancelRecurringSeriesHandler } from './cancel-recurring-series.handler';
import { PrismaService } from '../../../infrastructure/database';
import { CancelBookingHandler } from '../cancel-booking/cancel-booking.handler';
import { VALID_TRANSITIONS } from '../booking-state-machine';

describe('CancelRecurringSeriesHandler', () => {
  let handler: CancelRecurringSeriesHandler;
  let prisma: PrismaService;
  let cancelBooking: CancelBookingHandler;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CancelRecurringSeriesHandler,
        {
          provide: PrismaService,
          useValue: {
            booking: { findMany: jest.fn() },
          },
        },
        {
          provide: CancelBookingHandler,
          useValue: { execute: jest.fn() },
        },
      ],
    }).compile();

    handler = module.get<CancelRecurringSeriesHandler>(CancelRecurringSeriesHandler);
    prisma = module.get<PrismaService>(PrismaService);
    cancelBooking = module.get<CancelBookingHandler>(CancelBookingHandler);
  });

  it('should cancel all bookings', async () => {
    (prisma.booking.findMany as jest.Mock).mockResolvedValue([{ id: 'b1' }, { id: 'b2' }]);
    (cancelBooking.execute as jest.Mock).mockResolvedValue(undefined);
    const result = await handler.execute({ recurringGroupId: 'rg1', changedBy: 'u1', reason: CancellationReason.OTHER });
    expect(result.cancelled).toBe(2);
    expect(result.skipped).toBe(0);
  });

  it('should skip failed cancellations', async () => {
    (prisma.booking.findMany as jest.Mock).mockResolvedValue([{ id: 'b1' }, { id: 'b2' }]);
    (cancelBooking.execute as jest.Mock).mockRejectedValueOnce(new Error('Cannot cancel')).mockResolvedValueOnce(undefined);
    const result = await handler.execute({ recurringGroupId: 'rg1', changedBy: 'u1', reason: CancellationReason.OTHER });
    expect(result.cancelled).toBe(1);
    expect(result.skipped).toBe(1);
  });

  it('should filter by fromDate', async () => {
    (prisma.booking.findMany as jest.Mock).mockResolvedValue([{ id: 'b1' }]);
    (cancelBooking.execute as jest.Mock).mockResolvedValue(undefined);
    await handler.execute({ recurringGroupId: 'rg1', changedBy: 'u1', reason: CancellationReason.OTHER, fromDate: '2024-01-01' });
    expect(prisma.booking.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ scheduledAt: expect.anything() }),
    }));
  });

  it('should throw when no bookings found', async () => {
    (prisma.booking.findMany as jest.Mock).mockResolvedValue([]);
    await expect(handler.execute({ recurringGroupId: 'rg1', changedBy: 'u1', reason: CancellationReason.OTHER })).rejects.toThrow(NotFoundException);
  });

  it('queries only statuses listed in DIRECT_CANCEL state machine transition', async () => {
    (prisma.booking.findMany as jest.Mock).mockResolvedValue([{ id: 'b1' }]);
    (cancelBooking.execute as jest.Mock).mockResolvedValue(undefined);
    await handler.execute({ recurringGroupId: 'rg1', changedBy: 'u1', reason: CancellationReason.OTHER });
    const callWhere = (prisma.booking.findMany as jest.Mock).mock.calls[0][0].where;
    const expectedStatuses = VALID_TRANSITIONS.DIRECT_CANCEL.from;
    expect(callWhere.status).toEqual({ in: expectedStatuses });
    // Verify DIRECT_CANCEL covers the expected values
    expect(expectedStatuses).toContain(BookingStatus.PENDING);
    expect(expectedStatuses).toContain(BookingStatus.CONFIRMED);
    expect(expectedStatuses).toContain(BookingStatus.CANCEL_REQUESTED);
  });
});
