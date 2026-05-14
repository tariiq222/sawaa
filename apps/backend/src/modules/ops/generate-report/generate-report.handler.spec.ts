import { BadRequestException } from '@nestjs/common';
import { ReportType, ReportFormat } from '@prisma/client';
import { GenerateReportHandler } from './generate-report.handler';

const buildTenant = (organizationId = 'org-A') => ({
  requireOrganizationIdOrDefault: jest.fn().mockReturnValue(organizationId),
});

const mockReport = { id: 'report-1', type: ReportType.REVENUE, status: 'PENDING' as const };

const buildPrisma = () => ({
  report: {
    create: jest.fn().mockResolvedValue(mockReport),
    update: jest.fn().mockResolvedValue({ ...mockReport, status: 'COMPLETED' }),
  },
  payment: { findMany: jest.fn().mockResolvedValue([]) },
  booking: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0), groupBy: jest.fn().mockResolvedValue([]) },
  activityLog: { findMany: jest.fn().mockResolvedValue([]) },
  $queryRaw: jest.fn().mockResolvedValue([]),
});

jest.mock('./revenue-report.builder', () => ({
  buildRevenueReport: jest.fn().mockResolvedValue({ total: 0, items: [] }),
}));
jest.mock('./activity-report.builder', () => ({
  buildActivityReport: jest.fn().mockResolvedValue({ total: 0, items: [] }),
}));
jest.mock('./excel-export.builder', () => ({
  buildRevenueExcel: jest.fn().mockResolvedValue(Buffer.alloc(0)),
  buildActivityExcel: jest.fn().mockResolvedValue(Buffer.alloc(0)),
}));

describe('GenerateReportHandler', () => {
  it('throws BadRequestException when from >= to', async () => {
    const prisma = buildPrisma();
    const handler = new GenerateReportHandler(prisma as never, buildTenant() as never);

    await expect(
      handler.execute({
        type: ReportType.REVENUE,
        from: '2026-01-10', to: '2026-01-01',
        requestedBy: 'user-1',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('creates a report record with PENDING status initially', async () => {
    const prisma = buildPrisma();
    const handler = new GenerateReportHandler(prisma as never, buildTenant() as never);

    await handler.execute({
      type: ReportType.REVENUE,
      from: '2026-01-01', to: '2026-01-31',
      requestedBy: 'user-1',
    });

    expect(prisma.report.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'PENDING', type: ReportType.REVENUE }) }),
    );
  });

  it('generates a REVENUE report successfully', async () => {
    const prisma = buildPrisma();
    const handler = new GenerateReportHandler(prisma as never, buildTenant() as never);

    const result = await handler.execute({
      type: ReportType.REVENUE,
      from: '2026-01-01', to: '2026-01-31',
      requestedBy: 'user-1',
    });

    expect(result.type).toBe(ReportType.REVENUE);
    expect(result.status).toBe('COMPLETED');
  });

  it('generates an ACTIVITY report successfully', async () => {
    const prisma = buildPrisma();
    const handler = new GenerateReportHandler(prisma as never, buildTenant() as never);

    const result = await handler.execute({
      type: ReportType.ACTIVITY,
      from: '2026-01-01', to: '2026-01-31',
      requestedBy: 'user-1',
    });

    expect(result.type).toBe(ReportType.ACTIVITY);
  });

  it('defaults format to JSON when not specified', async () => {
    const prisma = buildPrisma();
    const handler = new GenerateReportHandler(prisma as never, buildTenant() as never);

    await handler.execute({
      type: ReportType.REVENUE,
      from: '2026-01-01', to: '2026-01-31',
      requestedBy: 'user-1',
    });

    expect(prisma.report.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ format: ReportFormat.JSON }) }),
    );
  });

  it('generates a BOOKINGS report', async () => {
    const prisma = buildPrisma();
    prisma.booking.groupBy = jest.fn().mockResolvedValue([
      { status: 'COMPLETED', _count: { status: 10 } },
      { status: 'CANCELLED', _count: { status: 2 } },
    ]);
    const handler = new GenerateReportHandler(prisma as never, buildTenant() as never);

    const result = await handler.execute({
      type: ReportType.BOOKINGS,
      from: '2026-01-01', to: '2026-01-31',
      requestedBy: 'user-1',
    });

    expect(result.type).toBe(ReportType.BOOKINGS);
    expect(result.status).toBe('COMPLETED');
  });

  it('generates an EMPLOYEES report', async () => {
    const prisma = buildPrisma();
    prisma.booking.groupBy = jest.fn().mockResolvedValue([
      { employeeId: 'emp-1', status: 'COMPLETED', _count: { employeeId: 5 } },
    ]);
    const handler = new GenerateReportHandler(prisma as never, buildTenant() as never);

    const result = await handler.execute({
      type: ReportType.EMPLOYEES,
      from: '2026-01-01', to: '2026-01-31',
      requestedBy: 'user-1',
    });

    expect(result.type).toBe(ReportType.EMPLOYEES);
  });
});
