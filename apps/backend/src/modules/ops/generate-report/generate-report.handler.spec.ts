import { ReportType, ReportFormat } from '@prisma/client';
import { GenerateReportHandler } from './generate-report.handler';

const mockReport = { id: 'report-1', type: ReportType.REVENUE, status: 'PENDING' as const };

const buildPrisma = () => ({
  report: {
    create: jest.fn().mockResolvedValue(mockReport),
    update: jest.fn().mockResolvedValue({ ...mockReport, status: 'COMPLETED' }),
  },
  payment: { findMany: jest.fn().mockResolvedValue([]) },
  booking: {
    findMany: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
    groupBy: jest.fn().mockResolvedValue([]),
  },
  client: {
    findMany: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
  },
  service: { findMany: jest.fn().mockResolvedValue([]) },
  employee: {
    findMany: jest.fn().mockResolvedValue([]),
    findUnique: jest.fn().mockResolvedValue(null),
  },
  rating: { findMany: jest.fn().mockResolvedValue([]) },
  refundRequest: { findMany: jest.fn().mockResolvedValue([]) },
  couponRedemption: { findMany: jest.fn().mockResolvedValue([]) },
  coupon: { findMany: jest.fn().mockResolvedValue([]) },
  activityLog: { findMany: jest.fn().mockResolvedValue([]) },
  $queryRaw: jest.fn().mockResolvedValue([]),
});

jest.mock('./revenue-report.builder', () => ({
  buildRevenueReport: jest.fn().mockResolvedValue({ totalRevenue: 0 }),
}));
jest.mock('./activity-report.builder', () => ({
  buildActivityReport: jest.fn().mockResolvedValue({ total: 0 }),
}));
jest.mock('./bookings-report.builder', () => ({
  buildBookingsReport: jest.fn().mockResolvedValue({ total: 0 }),
}));
jest.mock('./practitioners-report.builder', () => ({
  buildPractitionersReport: jest.fn().mockResolvedValue({ totalActive: 0, rows: [] }),
  buildPractitionerDetail: jest.fn().mockResolvedValue(null),
}));
jest.mock('./overview-report.builder', () => ({
  buildOverviewReport: jest.fn().mockResolvedValue({ totalRevenue: 0, trend: [] }),
}));
jest.mock('./clients-report.builder', () => ({
  buildClientsReport: jest.fn().mockResolvedValue({ total: 0 }),
}));
jest.mock('./services-report.builder', () => ({
  buildServicesReport: jest.fn().mockResolvedValue({ rows: [] }),
}));
jest.mock('./ratings-report.builder', () => ({
  buildRatingsReport: jest.fn().mockResolvedValue({ averageScore: 0, totalRatings: 0 }),
}));
jest.mock('./excel-export.builder', () => ({
  buildRevenueExcel: jest.fn().mockResolvedValue(Buffer.alloc(0)),
  buildActivityExcel: jest.fn().mockResolvedValue(Buffer.alloc(0)),
  buildBookingsExcel: jest.fn().mockResolvedValue(Buffer.alloc(0)),
  buildPractitionersExcel: jest.fn().mockResolvedValue(Buffer.alloc(0)),
  buildOverviewExcel: jest.fn().mockResolvedValue(Buffer.alloc(0)),
  buildClientsExcel: jest.fn().mockResolvedValue(Buffer.alloc(0)),
  buildServicesExcel: jest.fn().mockResolvedValue(Buffer.alloc(0)),
  buildRatingsExcel: jest.fn().mockResolvedValue(Buffer.alloc(0)),
}));

describe('GenerateReportHandler', () => {
  it('auto-swaps dates when from > to', async () => {
    const prisma = buildPrisma();
    const handler = new GenerateReportHandler(prisma as never);
    const result = await handler.execute({
      type: ReportType.REVENUE,
      from: '2026-01-10',
      to: '2026-01-01',
      requestedBy: 'user-1',
    });
    expect(result.status).toBe('COMPLETED');
  });

  it('allows from === to as a single-day report', async () => {
    const prisma = buildPrisma();
    const handler = new GenerateReportHandler(prisma as never);
    const result = await handler.execute({
      type: ReportType.REVENUE,
      from: '2026-01-15',
      to: '2026-01-15',
      requestedBy: 'user-1',
    });
    expect(result.status).toBe('COMPLETED');
  });

  it('creates a report record with PENDING status initially', async () => {
    const prisma = buildPrisma();
    const handler = new GenerateReportHandler(prisma as never);
    await handler.execute({
      type: ReportType.REVENUE,
      from: '2026-01-01',
      to: '2026-01-31',
      requestedBy: 'user-1',
    });
    expect(prisma.report.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'PENDING', type: ReportType.REVENUE }),
      }),
    );
  });

  it.each([
    ReportType.REVENUE,
    ReportType.ACTIVITY,
    ReportType.BOOKINGS,
    ReportType.EMPLOYEES,
    ReportType.OVERVIEW,
    ReportType.CLIENTS,
    ReportType.SERVICES,
    ReportType.RATINGS,
  ])('dispatches type %s successfully', async (type) => {
    const prisma = buildPrisma();
    const handler = new GenerateReportHandler(prisma as never);
    const result = await handler.execute({
      type,
      from: '2026-01-01',
      to: '2026-01-31',
      requestedBy: 'user-1',
    });
    expect(result.type).toBe(type);
    expect(result.status).toBe('COMPLETED');
  });

  it('defaults format to JSON when not specified', async () => {
    const prisma = buildPrisma();
    const handler = new GenerateReportHandler(prisma as never);
    await handler.execute({
      type: ReportType.REVENUE,
      from: '2026-01-01',
      to: '2026-01-31',
      requestedBy: 'user-1',
    });
    expect(prisma.report.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ format: ReportFormat.JSON }),
      }),
    );
  });

  it('attaches previous-period data when compareWithPrevious=true', async () => {
    const prisma = buildPrisma();
    const handler = new GenerateReportHandler(prisma as never);
    const result = await handler.execute({
      type: ReportType.OVERVIEW,
      from: '2026-01-01',
      to: '2026-01-31',
      compareWithPrevious: true,
      requestedBy: 'user-1',
    });
    expect(result.status).toBe('COMPLETED');
    expect(result.data).toMatchObject({ previous: expect.any(Object) });
  });

  it('returns excelBuffer when format is EXCEL', async () => {
    const prisma = buildPrisma();
    const handler = new GenerateReportHandler(prisma as never);
    const result = await handler.execute({
      type: ReportType.OVERVIEW,
      format: ReportFormat.EXCEL,
      from: '2026-01-01',
      to: '2026-01-31',
      requestedBy: 'user-1',
    });
    expect(result.excelBuffer).toBeInstanceOf(Buffer);
    expect(result.data).toBeUndefined();
  });

  it('marks report FAILED when builder throws', async () => {
    const prisma = buildPrisma();
    const { buildOverviewReport } = jest.requireMock('./overview-report.builder');
    buildOverviewReport.mockRejectedValueOnce(new Error('boom'));
    const handler = new GenerateReportHandler(prisma as never);
    await expect(
      handler.execute({
        type: ReportType.OVERVIEW,
        from: '2026-01-01',
        to: '2026-01-31',
        requestedBy: 'user-1',
      }),
    ).rejects.toThrow('boom');
    expect(prisma.report.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'FAILED', errorMsg: 'boom' }),
      }),
    );
  });
});
