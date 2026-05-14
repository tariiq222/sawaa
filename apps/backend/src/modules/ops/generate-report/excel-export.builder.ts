import ExcelJS from 'exceljs';
import type { RevenueReportResult } from './revenue-report.builder';
import type { ActivityReportResult } from './activity-report.builder';

export async function buildRevenueExcel(report: RevenueReportResult): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();

  // Summary sheet
  const summary = wb.addWorksheet('Summary');
  summary.columns = [
    { header: 'Metric', key: 'metric', width: 30 },
    { header: 'Value', key: 'value', width: 20 },
  ];
  const s = report.summary;
  summary.addRows([
    { metric: 'Total Revenue (⃁)', value: s.totalRevenue.toFixed(2) },
    { metric: 'Total Payments', value: s.totalPayments },
    { metric: 'Total Bookings', value: s.totalBookings },
    { metric: 'Completed Bookings', value: s.completedBookings },
    { metric: 'Cancelled Bookings', value: s.cancelledBookings },
    { metric: 'Avg Booking Value (⃁)', value: s.averageBookingValue.toFixed(2) },
  ]);
  styleHeaderRow(summary);

  // By Day sheet
  const byDay = wb.addWorksheet('By Day');
  byDay.columns = [
    { header: 'Date', key: 'date', width: 15 },
    { header: 'Revenue (⃁)', key: 'revenue', width: 18 },
    { header: 'Payments', key: 'count', width: 12 },
  ];
  byDay.addRows(report.byDay);
  styleHeaderRow(byDay);

  // By Branch sheet
  const byBranch = wb.addWorksheet('By Branch');
  byBranch.columns = [
    { header: 'Branch ID', key: 'branchId', width: 36 },
    { header: 'Revenue (⃁)', key: 'revenue', width: 18 },
    { header: 'Bookings', key: 'count', width: 12 },
  ];
  byBranch.addRows(report.byBranch);
  styleHeaderRow(byBranch);

  // By Employee sheet
  const byEmployee = wb.addWorksheet('By Employee');
  byEmployee.columns = [
    { header: 'Employee ID', key: 'employeeId', width: 36 },
    { header: 'Revenue (⃁)', key: 'revenue', width: 18 },
    { header: 'Bookings', key: 'count', width: 12 },
  ];
  byEmployee.addRows(report.byEmployee);
  styleHeaderRow(byEmployee);

  return wb.xlsx.writeBuffer() as unknown as Promise<Buffer>;
}

export async function buildActivityExcel(report: ActivityReportResult): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();

  // Summary sheet
  const summary = wb.addWorksheet('Summary');
  summary.columns = [
    { header: 'Metric', key: 'metric', width: 25 },
    { header: 'Value', key: 'value', width: 15 },
  ];
  summary.addRows([
    { metric: 'Total Actions', value: report.summary.totalActions },
    { metric: 'Unique Users', value: report.summary.uniqueUsers },
  ]);
  styleHeaderRow(summary);

  // By Day sheet
  const byDay = wb.addWorksheet('By Day');
  byDay.columns = [
    { header: 'Date', key: 'date', width: 15 },
    { header: 'Actions', key: 'count', width: 12 },
  ];
  byDay.addRows(report.byDay);
  styleHeaderRow(byDay);

  // Top Users sheet
  const byUser = wb.addWorksheet('Top Users');
  byUser.columns = [
    { header: 'User ID', key: 'userId', width: 36 },
    { header: 'Email', key: 'userEmail', width: 30 },
    { header: 'Actions', key: 'count', width: 12 },
  ];
  byUser.addRows(report.byUser);
  styleHeaderRow(byUser);

  return wb.xlsx.writeBuffer() as unknown as Promise<Buffer>;
}

function styleHeaderRow(ws: ExcelJS.Worksheet): void {
  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF354FD8' },
  };
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
}
