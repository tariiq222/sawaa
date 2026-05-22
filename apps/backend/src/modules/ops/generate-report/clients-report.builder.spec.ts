import { BookingStatus } from '@prisma/client';
import { buildClientsReport } from './clients-report.builder';

function makePrisma() {
  return {
    booking: { findMany: jest.fn().mockResolvedValue([]) },
    client: {
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
    },
  } as any;
}

describe('buildClientsReport', () => {
  let prisma: any;

  beforeEach(() => {
    prisma = makePrisma();
  });

  it('returns zero state when no bookings or clients', async () => {
    const result = await buildClientsReport(prisma, {
      from: new Date('2025-01-01'),
      to: new Date('2025-01-31'),
    });
    expect(result.total).toBe(0);
    expect(result.newClients).toBe(0);
    expect(result.returningClients).toBe(0);
    expect(result.retentionRate).toBe(0);
    expect(result.byGender).toEqual([]);
    expect(result.byAgeGroup).toEqual([]);
    expect(result.topByRevenue).toEqual([]);
  });

  it('classifies returning vs new and computes retention', async () => {
    prisma.booking.findMany.mockResolvedValue([
      { clientId: 'c1', status: BookingStatus.COMPLETED, price: '300' },
      { clientId: 'c2', status: BookingStatus.COMPLETED, price: '500' },
    ]);
    prisma.client.count.mockResolvedValue(1); // newClients in window
    prisma.client.findMany.mockResolvedValue([
      { id: 'c1', name: 'A', firstName: 'A', lastName: 'X', gender: 'MALE', dateOfBirth: new Date('1990-01-01'), createdAt: new Date('2024-06-01') },
      { id: 'c2', name: 'B', firstName: 'B', lastName: 'Y', gender: 'FEMALE', dateOfBirth: new Date('2010-01-01'), createdAt: new Date('2025-01-10') },
    ]);

    const result = await buildClientsReport(prisma, {
      from: new Date('2025-01-01'),
      to: new Date('2025-01-31'),
    });
    expect(result.total).toBe(2);
    expect(result.returningClients).toBe(1); // c1 createdAt < from
    expect(result.retentionRate).toBeCloseTo(0.5);
    expect(result.byGender).toHaveLength(2);
    expect(result.topByRevenue).toHaveLength(2);
    expect(result.topByRevenue[0].clientId).toBe('c2');
    expect(result.topByRevenue[0].revenue).toBe(500);
  });

  it('buckets clients into age groups including UNKNOWN', async () => {
    prisma.booking.findMany.mockResolvedValue([
      { clientId: 'c1', status: BookingStatus.COMPLETED, price: '100' },
      { clientId: 'c2', status: BookingStatus.COMPLETED, price: '100' },
    ]);
    prisma.client.findMany.mockResolvedValue([
      { id: 'c1', name: 'A', firstName: null, lastName: null, gender: null, dateOfBirth: null, createdAt: new Date('2024-01-01') },
      { id: 'c2', name: 'B', firstName: null, lastName: null, gender: 'FEMALE', dateOfBirth: new Date('1980-01-01'), createdAt: new Date('2024-01-01') },
    ]);

    const result = await buildClientsReport(prisma, {
      from: new Date('2025-01-01'),
      to: new Date('2025-01-31'),
    });
    const groups = result.byAgeGroup.map((g) => g.group);
    expect(groups).toContain('UNKNOWN');
  });
});
