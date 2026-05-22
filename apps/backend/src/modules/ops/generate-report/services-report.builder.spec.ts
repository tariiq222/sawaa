import { BookingStatus } from '@prisma/client';
import { buildServicesReport } from './services-report.builder';

function makePrisma() {
  return {
    booking: { findMany: jest.fn().mockResolvedValue([]) },
    service: { findMany: jest.fn().mockResolvedValue([]) },
    rating: { findMany: jest.fn().mockResolvedValue([]) },
  } as any;
}

describe('buildServicesReport', () => {
  let prisma: any;

  beforeEach(() => {
    prisma = makePrisma();
  });

  it('returns empty rows when no bookings', async () => {
    const result = await buildServicesReport(prisma, {
      from: new Date('2025-01-01'),
      to: new Date('2025-01-31'),
    });
    expect(result.rows).toEqual([]);
  });

  it('aggregates bookings, revenue, cancel rate, and rating per service', async () => {
    prisma.booking.findMany.mockResolvedValue([
      { id: 'b1', serviceId: 's1', status: BookingStatus.COMPLETED, price: '300' },
      { id: 'b2', serviceId: 's1', status: BookingStatus.COMPLETED, price: '200' },
      { id: 'b3', serviceId: 's1', status: BookingStatus.CANCELLED, price: '100' },
      { id: 'b4', serviceId: 's2', status: BookingStatus.COMPLETED, price: '500' },
    ]);
    prisma.service.findMany.mockResolvedValue([
      { id: 's1', nameAr: 'استشارة', nameEn: 'Consult' },
      { id: 's2', nameAr: 'جلسة', nameEn: 'Session' },
    ]);
    prisma.rating.findMany.mockResolvedValue([
      { bookingId: 'b1', score: 5 },
      { bookingId: 'b2', score: 3 },
      { bookingId: 'b4', score: 4 },
    ]);

    const result = await buildServicesReport(prisma, {
      from: new Date('2025-01-01'),
      to: new Date('2025-01-31'),
    });
    expect(result.rows).toHaveLength(2);
    const s1 = result.rows.find((r) => r.serviceId === 's1');
    expect(s1?.bookings).toBe(3);
    expect(s1?.completedBookings).toBe(2);
    expect(s1?.revenue).toBe(500);
    expect(s1?.cancelRate).toBeCloseTo(1 / 3);
    expect(s1?.averageRating).toBeCloseTo(4); // (5+3)/2
    const s2 = result.rows.find((r) => r.serviceId === 's2');
    expect(s2?.averageRating).toBe(4);
  });
});
