import { BookingStatus, BookingType, CancellationReason } from '@prisma/client';
import { buildBookingsReport } from './bookings-report.builder';

function makePrisma() {
  return {
    booking: {
      count: jest.fn().mockResolvedValue(0),
      groupBy: jest.fn().mockResolvedValue([]),
      findMany: jest.fn().mockResolvedValue([]),
    },
  } as any;
}

describe('buildBookingsReport', () => {
  let prisma: any;

  beforeEach(() => {
    prisma = makePrisma();
  });

  it('returns zero state when no bookings', async () => {
    const result = await buildBookingsReport(prisma, {
      from: new Date('2025-01-01'),
      to: new Date('2025-01-31'),
    });
    expect(result.total).toBe(0);
    expect(result.noShowRate).toBe(0);
    expect(result.cancelRate).toBe(0);
    expect(result.avgDurationMins).toBe(0);
    expect(result.byHourDow).toEqual([]);
  });

  it('computes no-show and cancel rates correctly', async () => {
    prisma.booking.count.mockResolvedValue(10);
    prisma.booking.groupBy
      .mockResolvedValueOnce([
        { status: BookingStatus.COMPLETED, _count: { status: 7 } },
        { status: BookingStatus.NO_SHOW, _count: { status: 1 } },
        { status: BookingStatus.CANCELLED, _count: { status: 2 } },
      ])
      .mockResolvedValueOnce([
        { bookingType: BookingType.INDIVIDUAL, _count: { bookingType: 8 } },
        { bookingType: BookingType.GROUP, _count: { bookingType: 2 } },
      ]);
    prisma.booking.findMany.mockResolvedValue([
      { scheduledAt: new Date('2025-01-15T10:00:00Z'), status: BookingStatus.COMPLETED, durationMins: 60, cancelReason: null },
      { scheduledAt: new Date('2025-01-15T11:00:00Z'), status: BookingStatus.CANCELLED, durationMins: 60, cancelReason: CancellationReason.CLIENT_REQUESTED },
      { scheduledAt: new Date('2025-01-16T10:00:00Z'), status: BookingStatus.NO_SHOW, durationMins: 60, cancelReason: null },
      { scheduledAt: new Date('2025-01-16T11:00:00Z'), status: BookingStatus.CANCELLED, durationMins: 60, cancelReason: null },
    ]);

    const result = await buildBookingsReport(prisma, {
      from: new Date('2025-01-01'),
      to: new Date('2025-01-31'),
    });
    expect(result.noShowRate).toBeCloseTo(0.1);
    expect(result.cancelRate).toBeCloseTo(0.2);
    expect(result.avgDurationMins).toBe(60);
    expect(result.byHourDow.length).toBeGreaterThan(0);
    expect(result.byCancelReason.find((r) => r.reason === 'UNSPECIFIED')?.count).toBe(1);
    expect(result.byCancelReason.find((r) => r.reason === CancellationReason.CLIENT_REQUESTED)?.count).toBe(1);
  });
});
