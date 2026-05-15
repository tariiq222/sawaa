import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CancelRecurringSeriesHandler } from './cancel-recurring-series.handler';
import { PrismaService } from '../../../infrastructure/database';
import { CancelBookingHandler } from '../cancel-booking/cancel-booking.handler';

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
    const result = await handler.execute({ recurringGroupId: 'rg1', changedBy: 'u1', reason: 'test' });
    expect(result.cancelled).toBe(2);
    expect(result.skipped).toBe(0);
  });

  it('should skip failed cancellations', async () => {
    (prisma.booking.findMany as jest.Mock).mockResolvedValue([{ id: 'b1' }, { id: 'b2' }]);
    (cancelBooking.execute as jest.Mock).mockRejectedValueOnce(new Error('Cannot cancel')).mockResolvedValueOnce(undefined);
    const result = await handler.execute({ recurringGroupId: 'rg1', changedBy: 'u1', reason: 'test' });
    expect(result.cancelled).toBe(1);
    expect(result.skipped).toBe(1);
  });

  it('should filter by fromDate', async () => {
    (prisma.booking.findMany as jest.Mock).mockResolvedValue([{ id: 'b1' }]);
    (cancelBooking.execute as jest.Mock).mockResolvedValue(undefined);
    await handler.execute({ recurringGroupId: 'rg1', changedBy: 'u1', reason: 'test', fromDate: '2024-01-01' });
    expect(prisma.booking.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ scheduledAt: expect.anything() }),
    }));
  });

  it('should throw when no bookings found', async () => {
    (prisma.booking.findMany as jest.Mock).mockResolvedValue([]);
    await expect(handler.execute({ recurringGroupId: 'rg1', changedBy: 'u1', reason: 'test' })).rejects.toThrow(NotFoundException);
  });
});
