import { BookingStatus } from '@prisma/client';
import {
  buildPractitionerDetail,
  buildPractitionersReport,
} from './practitioners-report.builder';

function makePrisma() {
  return {
    booking: { findMany: jest.fn().mockResolvedValue([]) },
    employee: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
    },
    rating: { findMany: jest.fn().mockResolvedValue([]) },
  } as any;
}

describe('buildPractitionersReport', () => {
  let prisma: any;

  beforeEach(() => {
    prisma = makePrisma();
  });

  it('returns zero state when no bookings', async () => {
    const result = await buildPractitionersReport(prisma, {
      from: new Date('2025-01-01'),
      to: new Date('2025-01-31'),
    });
    expect(result.totalActive).toBe(0);
    expect(result.totalCompleted).toBe(0);
    expect(result.rows).toEqual([]);
  });

  it('groups bookings by employee with completion and rating', async () => {
    prisma.booking.findMany.mockResolvedValue([
      { id: 'b1', employeeId: 'e1', status: BookingStatus.COMPLETED, price: '300', durationMins: 60 },
      { id: 'b2', employeeId: 'e1', status: BookingStatus.COMPLETED, price: '300', durationMins: 60 },
      { id: 'b3', employeeId: 'e1', status: BookingStatus.PENDING, price: '300', durationMins: 60 },
      { id: 'b4', employeeId: 'e2', status: BookingStatus.COMPLETED, price: '500', durationMins: 60 },
    ]);
    prisma.employee.findMany.mockResolvedValue([
      { id: 'e1', name: 'A', nameAr: 'أحمد', specialty: 'Family', specialtyAr: 'أسري' },
      { id: 'e2', name: 'B', nameAr: 'سارة', specialty: 'Psych', specialtyAr: 'نفسي' },
    ]);
    prisma.rating.findMany.mockResolvedValue([
      { employeeId: 'e1', score: 5 },
      { employeeId: 'e1', score: 4 },
      { employeeId: 'e2', score: 5 },
    ]);

    const result = await buildPractitionersReport(prisma, {
      from: new Date('2025-01-01'),
      to: new Date('2025-01-31'),
    });
    expect(result.totalActive).toBe(2);
    expect(result.totalCompleted).toBe(3);
    expect(result.rows).toHaveLength(2);
    const e1 = result.rows.find((r) => r.employeeId === 'e1');
    expect(e1?.bookings).toBe(3);
    expect(e1?.completedBookings).toBe(2);
    expect(e1?.revenue).toBe(600);
    expect(e1?.completionRate).toBeCloseTo(2 / 3);
    expect(e1?.averageRating).toBe(4.5);
  });
});

describe('buildPractitionerDetail', () => {
  let prisma: any;

  beforeEach(() => {
    prisma = makePrisma();
  });

  it('returns null when employeeId is missing', async () => {
    const result = await buildPractitionerDetail(prisma, {
      from: new Date('2025-01-01'),
      to: new Date('2025-01-31'),
    });
    expect(result).toBeNull();
  });

  it('returns detail with byDay aggregation', async () => {
    prisma.booking.findMany.mockResolvedValue([
      { id: 'b1', scheduledAt: new Date('2025-01-10T10:00:00Z'), status: BookingStatus.COMPLETED, price: '300', durationMins: 60 },
      { id: 'b2', scheduledAt: new Date('2025-01-10T11:00:00Z'), status: BookingStatus.COMPLETED, price: '200', durationMins: 60 },
      { id: 'b3', scheduledAt: new Date('2025-01-11T10:00:00Z'), status: BookingStatus.PENDING, price: '100', durationMins: 60 },
    ]);
    prisma.employee.findUnique.mockResolvedValue({
      id: 'e1',
      name: 'A',
      nameAr: 'أحمد',
      specialty: null,
      specialtyAr: null,
    });
    prisma.rating.findMany.mockResolvedValue([{ score: 5 }, { score: 3 }]);

    const result = await buildPractitionerDetail(prisma, {
      from: new Date('2025-01-01'),
      to: new Date('2025-01-31'),
      employeeId: 'e1',
    });
    expect(result?.employeeId).toBe('e1');
    expect(result?.bookings).toBe(3);
    expect(result?.completedBookings).toBe(2);
    expect(result?.revenue).toBe(500);
    expect(result?.averageRating).toBe(4);
    expect(result?.byDay).toHaveLength(2);
  });
});
