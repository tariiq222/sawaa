import { buildRevenueExcel, buildActivityExcel } from './excel-export.builder';

const mockRevenueReport = {
  totalRevenue: 15000.5,
  totalBookings: 50,
  averagePerBooking: 300.01,
  byMethod: [
    { method: 'CASH', amount: 10000, count: 30 },
    { method: 'MOYASAR', amount: 5000.5, count: 20 },
  ],
  byDay: [
    { date: '2026-04-01', amount: 5000, count: 15 },
    { date: '2026-04-02', amount: 10000.5, count: 30 },
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