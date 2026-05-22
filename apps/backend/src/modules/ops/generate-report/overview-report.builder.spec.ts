import { BookingStatus, PaymentStatus } from '@prisma/client';
import { buildOverviewReport } from './overview-report.builder';

function makePrisma() {
  return {
    booking: {
      findMany: jest.fn().mockResolvedValue([]),
      groupBy: jest.fn().mockResolvedValue([]),
    },
    client: { count: jest.fn().mockResolvedValue(0) },
    payment: { findMany: jest.fn().mockResolvedValue([]) },
    service: { findMany: jest.fn().mockResolvedValue([]) },
    employee: { findMany: jest.fn().mockResolvedValue([]) },
  } as any;
}

describe('buildOverviewReport', () => {
  let prisma: any;

  beforeEach(() => {
    prisma = makePrisma();
  });

  it('returns zeros when no bookings/payments/clients', async () => {
    const result = await buildOverviewReport(prisma, {
      from: new Date('2025-01-01'),
      to: new Date('2025-01-31'),
    });
    expect(result.totalRevenue).toBe(0);
    expect(result.totalBookings).toBe(0);
    expect(result.completedBookings).toBe(0);
    expect(result.completionRate).toBe(0);
    expect(result.newClients).toBe(0);
    expect(result.trend).toEqual([]);
    expect(result.topServices).toEqual([]);
    expect(result.topPractitioners).toEqual([]);
  });

  it('aggregates revenue, bookings, and new clients', async () => {
    prisma.booking.findMany.mockResolvedValue([
      { id: 'b1', serviceId: 's1', employeeId: 'e1', scheduledAt: new Date('2025-01-10'), status: BookingStatus.COMPLETED, price: '300' },
      { id: 'b2', serviceId: 's1', employeeId: 'e1', scheduledAt: new Date('2025-01-11'), status: BookingStatus.COMPLETED, price: '200' },
      { id: 'b3', serviceId: 's2', employeeId: 'e2', scheduledAt: new Date('2025-01-11'), status: BookingStatus.PENDING, price: '150' },
    ]);
    prisma.booking.groupBy.mockResolvedValue([
      { status: BookingStatus.COMPLETED, _count: { status: 2 } },
      { status: BookingStatus.PENDING, _count: { status: 1 } },
    ]);
    prisma.client.count.mockResolvedValue(5);
    prisma.payment.findMany.mockResolvedValue([
      { amount: '300', createdAt: new Date('2025-01-10'), invoiceId: 'i1' },
      { amount: '200', createdAt: new Date('2025-01-11'), invoiceId: 'i2' },
    ]);
    prisma.service.findMany.mockResolvedValue([
      { id: 's1', nameAr: 'استشارة زوجية', nameEn: 'Couples' },
      { id: 's2', nameAr: 'جلسة فردية', nameEn: 'Individual' },
    ]);
    prisma.employee.findMany.mockResolvedValue([
      { id: 'e1', name: 'Ahmed', nameAr: 'أحمد' },
    ]);

    const result = await buildOverviewReport(prisma, {
      from: new Date('2025-01-01'),
      to: new Date('2025-01-31'),
    });
    expect(result.totalRevenue).toBe(500);
    expect(result.totalBookings).toBe(3);
    expect(result.completedBookings).toBe(2);
    expect(result.completionRate).toBeCloseTo(2 / 3);
    expect(result.newClients).toBe(5);
    expect(result.trend).toHaveLength(2);
    expect(result.topServices[0].serviceId).toBe('s1');
    expect(result.topServices[0].count).toBe(2);
    expect(result.topPractitioners[0].employeeId).toBe('e1');
    expect(result.topPractitioners[0].revenue).toBe(500);
  });

  it('takes only top 4 services and top 3 practitioners', async () => {
    const bookings = [];
    for (let i = 1; i <= 10; i++) {
      bookings.push({
        id: `b${i}`,
        serviceId: `s${i}`,
        employeeId: `e${i}`,
        scheduledAt: new Date('2025-01-10'),
        status: BookingStatus.COMPLETED,
        price: String(100 * i),
      });
    }
    prisma.booking.findMany.mockResolvedValue(bookings);
    prisma.booking.groupBy.mockResolvedValue([
      { status: BookingStatus.COMPLETED, _count: { status: 10 } },
    ]);
    prisma.service.findMany.mockResolvedValue(
      Array.from({ length: 10 }, (_, i) => ({
        id: `s${i + 1}`,
        nameAr: `خدمة ${i + 1}`,
        nameEn: null,
      })),
    );
    prisma.employee.findMany.mockResolvedValue(
      Array.from({ length: 10 }, (_, i) => ({
        id: `e${i + 1}`,
        name: `Emp ${i + 1}`,
        nameAr: null,
      })),
    );

    const result = await buildOverviewReport(prisma, {
      from: new Date('2025-01-01'),
      to: new Date('2025-01-31'),
    });
    expect(result.topServices).toHaveLength(4);
    expect(result.topPractitioners).toHaveLength(3);
  });
});
