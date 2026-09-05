import { BookingStatus, BookingType, CancellationReason } from '@prisma/client';
import { buildBookingsReport } from './bookings-report.builder';

function makePrisma() {
  return {
    booking: {
      count: jest.fn().mockResolvedValue(0),
      groupBy: jest.fn().mockResolvedValue([]),
      findMany: jest.fn().mockResolvedValue([]),
    },
    $queryRaw: jest.fn().mockResolvedValue([]),
  } as any;
}

describe('buildBookingsReport', () => {
  let prisma: any;

  beforeEach(() => {
    prisma = makePrisma();
  });

  it('does not read the booking report dataset as full rows', async () => {
    await buildBookingsReport(prisma, {
      from: new Date('2025-01-01'),
      to: new Date('2025-01-31'),
    });

    expect(prisma.booking.findMany).not.toHaveBeenCalled();
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
    prisma.$queryRaw
      .mockResolvedValueOnce([{ total: 10n, avgDurationMins: '60' }])
      .mockResolvedValueOnce([
        { status: BookingStatus.COMPLETED, count: 7n },
        { status: BookingStatus.NO_SHOW, count: '1' },
        { status: BookingStatus.CANCELLED, count: 2n },
      ])
      .mockResolvedValueOnce([
        { type: BookingType.INDIVIDUAL, count: 8 },
        { type: BookingType.GROUP, count: 2 },
      ])
      .mockResolvedValueOnce([
        { date: '2025-01-15', count: 2 },
        { date: '2025-01-16', count: 2 },
      ])
      .mockResolvedValueOnce([
        { dow: 3, hour: 10, count: 2 },
        { dow: 3, hour: 11, count: 1 },
        { dow: 4, hour: 10, count: 1 },
      ])
      .mockResolvedValueOnce([
        { reason: CancellationReason.CLIENT_REQUESTED, count: 1 },
        { reason: 'UNSPECIFIED', count: 1 },
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
