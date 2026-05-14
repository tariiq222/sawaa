import { buildRevenueExcel, buildActivityExcel } from './excel-export.builder';

const mockRevenueReport = {
  period: { from: '2026-04-01T00:00:00.000Z', to: '2026-04-02T23:59:59.000Z' },
  summary: {
    totalRevenue: 15000.5,
    totalPayments: 45,
    totalBookings: 50,
    completedBookings: 40,
    cancelledBookings: 5,
    averageBookingValue: 300.01,
  },
  byDay: [
    { date: '2026-04-01', revenue: 5000, count: 15 },
    { date: '2026-04-02', revenue: 10000.5, count: 30 },
  ],
  byBranch: [
    { branchId: 'branch-1', revenue: 10000, count: 30 },
    { branchId: 'branch-2', revenue: 5000.5, count: 20 },
  ],
  byEmployee: [
    { employeeId: 'emp-1', revenue: 8000, count: 25 },
    { employeeId: 'emp-2', revenue: 7000.5, count: 25 },
  ],
};

const mockActivityReport = {
  period: { from: '2026-04-01T00:00:00.000Z', to: '2026-04-02T23:59:59.000Z' },
  summary: {
    totalActions: 200,
    uniqueUsers: 50,
    topEntities: [{ entity: 'Booking', count: 100 }],
    topActions: [{ action: 'CREATE', count: 80 }],
  },
  byDay: [
    { date: '2026-04-01', count: 100 },
    { date: '2026-04-02', count: 100 },
  ],
  byUser: [
    { userId: 'user-1', userEmail: 'a@clinic.sa', count: 50 },
    { userId: 'user-2', userEmail: 'b@clinic.sa', count: 30 },
  ],
};

describe('excel-export builder', () => {
  describe('buildRevenueExcel', () => {
    it('returns a buffer', async () => {
      const result = await buildRevenueExcel(mockRevenueReport);
      expect(Buffer.isBuffer(result)).toBe(true);
    });

    it('contains summary sheet with metrics', async () => {
      const result = await buildRevenueExcel(mockRevenueReport);
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('buildActivityExcel', () => {
    it('returns a buffer', async () => {
      const result = await buildActivityExcel(mockActivityReport);
      expect(Buffer.isBuffer(result)).toBe(true);
    });

    it('contains activity metrics', async () => {
      const result = await buildActivityExcel(mockActivityReport);
      expect(result.length).toBeGreaterThan(0);
    });
  });
});