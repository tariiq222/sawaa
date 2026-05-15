import { DashboardOpsController } from './ops.controller';
import { ReportFormat } from '@prisma/client';

describe('DashboardOpsController', () => {
  let controller: DashboardOpsController;
  let generateReport: jest.Mock;
  let listActivity: jest.Mock;
  let resMock: any;

  beforeEach(() => {
    generateReport = jest.fn();
    listActivity = jest.fn();
    resMock = {
      setHeader: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };
    controller = new DashboardOpsController(
      { execute: generateReport } as any,
      { execute: listActivity } as any,
    );
  });

  it('should be defined', () => expect(controller).toBeDefined());

  it('generateReportEndpoint should return JSON when format is not EXCEL', async () => {
    const result = { format: ReportFormat.JSON, data: [] };
    generateReport.mockResolvedValue(result);

    const response = await controller.generateReportEndpoint({ format: ReportFormat.JSON, reportType: 'bookings' } as any, resMock);
    expect(response).toEqual(result);
    expect(resMock.send).not.toHaveBeenCalled();
  });

  it('generateReportEndpoint should send xlsx buffer when format is EXCEL', async () => {
    const result = { format: ReportFormat.EXCEL, reportId: 'r1', excelBuffer: Buffer.from('xlsx') };
    generateReport.mockResolvedValue(result);

    const response = await controller.generateReportEndpoint({ format: ReportFormat.EXCEL, reportType: 'revenue' } as any, resMock);
    expect(resMock.setHeader).toHaveBeenCalledWith('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(resMock.setHeader).toHaveBeenCalledWith('Content-Disposition', 'attachment; filename="report-r1.xlsx"');
    expect(resMock.send).toHaveBeenCalledWith(result.excelBuffer);
    expect(response).toBeUndefined();
  });

  it('generateReportEndpoint should return result when EXCEL but no buffer', async () => {
    const result = { format: ReportFormat.EXCEL, reportId: 'r1' };
    generateReport.mockResolvedValue(result);

    const response = await controller.generateReportEndpoint({ format: ReportFormat.EXCEL, reportType: 'revenue' } as any, resMock);
    expect(response).toEqual(result);
    expect(resMock.send).not.toHaveBeenCalled();
  });

  it('listActivityEndpoint should call listActivity.execute with orgId', async () => {
    const query = { page: 1, limit: 10 };
    listActivity.mockResolvedValue({ data: [], total: 0 });

    await controller.listActivityEndpoint(query as any);
    expect(listActivity).toHaveBeenCalledWith(expect.objectContaining({ organizationId: expect.any(String), ...query }));
  });
});
