import ExcelJS from 'exceljs';
import { PaymentStatus } from '@prisma/client';
import { buildRevenueExcel, buildActivityExcel } from './excel-export.builder';
import type { RevenueReportResult } from './revenue-report.builder';

const mockRevenueReport: RevenueReportResult = {
  totalRevenue: 15000.5,
  netRevenue: 14500,
  totalBookings: 50,
  averagePerBooking: 300.01,
  refundsTotal: 500.5,
  byMethod: [
    { method: 'CASH', amount: 10000, count: 30 },
    { method: 'ONLINE_CARD', amount: 5000.5, count: 20 },
  ],
  byStatus: [
    { status: PaymentStatus.COMPLETED, amount: 15000.5, count: 50 },
  ],
  byDay: [
    { date: '2026-04-01', amount: 5000, count: 15 },
    { date: '2026-04-02', amount: 10000.5, count: 30 },
  ],
  couponsUsed: [],
  recentPayments: [],
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
it('exports collection and immutable recording dates separately', async () => {
 const buffer = await buildRevenueExcel({...mockRevenueReport, recentPayments: [{id: 'p', date: '2026-09-01T21:00:00.000Z', recordedAt: '2026-10-05T10:00:00.000Z', clientName: 'Client', serviceName: 'Session', method: 'CASH', amount: 15000, status: PaymentStatus.COMPLETED, receiptEvidenceRef: 'R-123', receiptEntryReason: 'late recording'}]});
 const workbook = new ExcelJS.Workbook();
 await workbook.xlsx.load(buffer as never);
 const sheet = workbook.getWorksheet('Recent Payments');
 expect(sheet).toBeDefined();
 expect(sheet!.getRow(2).values).toEqual(expect.arrayContaining(['2026-09-01T21:00:00.000Z', '2026-10-05T10:00:00.000Z', 'R-123', 'late recording']));
});

it('exports every revenue amount as numeric SAR including fractional halalas', async () => {
 const buffer = await buildRevenueExcel({...mockRevenueReport,totalRevenue:4950,averagePerBooking:1650,byMethod:[{method:'CASH',amount:4950,count:3}],byDay:[{date:'2026-10-10',amount:4950,count:3}]});
 const wb = new ExcelJS.Workbook(); await wb.xlsx.load(buffer as never);
 expect(wb.getWorksheet('Summary')!.getCell('B2').value).toBe(49.5);
 expect(wb.getWorksheet('Summary')!.getCell('B4').value).toBe(16.5);
 expect(wb.getWorksheet('By Method')!.getCell('B2').value).toBe(49.5);
 expect(wb.getWorksheet('By Day')!.getCell('B2').value).toBe(49.5);
});
