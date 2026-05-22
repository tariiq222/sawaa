import ExcelJS from 'exceljs';
import type { RevenueReportResult } from './revenue-report.builder';
import type { ActivityReportResult } from './activity-report.builder';
import type { BookingsReportResult } from './bookings-report.builder';
import type {
  PractitionersReportResult,
  PractitionerDetailResult,
} from './practitioners-report.builder';
import type { OverviewReportResult } from './overview-report.builder';
import type { ClientsReportResult } from './clients-report.builder';
import type { ServicesReportResult } from './services-report.builder';
import type { RatingsReportResult } from './ratings-report.builder';

export async function buildRevenueExcel(report: RevenueReportResult): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();

  // Summary sheet
  const summary = wb.addWorksheet('Summary');
  summary.columns = [
    { header: 'Metric', key: 'metric', width: 30 },
    { header: 'Value', key: 'value', width: 20 },
  ];
  summary.addRows([
    { metric: 'Total Revenue (⃁)', value: report.totalRevenue.toFixed(2) },
    { metric: 'Total Bookings', value: report.totalBookings },
    { metric: 'Avg Per Booking (⃁)', value: report.averagePerBooking.toFixed(2) },
  ]);
  styleHeaderRow(summary);

  // By Method sheet
  const byMethod = wb.addWorksheet('By Method');
  byMethod.columns = [
    { header: 'Method', key: 'method', width: 20 },
    { header: 'Amount (⃁)', key: 'amount', width: 18 },
    { header: 'Payments', key: 'count', width: 12 },
  ];
  byMethod.addRows(report.byMethod);
  styleHeaderRow(byMethod);

  // By Day sheet
  const byDay = wb.addWorksheet('By Day');
  byDay.columns = [
    { header: 'Date', key: 'date', width: 15 },
    { header: 'Amount (⃁)', key: 'amount', width: 18 },
    { header: 'Payments', key: 'count', width: 12 },
  ];
  byDay.addRows(report.byDay);
  styleHeaderRow(byDay);

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

export async function buildBookingsExcel(report: BookingsReportResult): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const summary = wb.addWorksheet('Summary');
  summary.columns = [
    { header: 'Metric', key: 'metric', width: 30 },
    { header: 'Value', key: 'value', width: 20 },
  ];
  summary.addRows([
    { metric: 'Total Bookings', value: report.total },
    { metric: 'No-show Rate', value: (report.noShowRate * 100).toFixed(1) + '%' },
    { metric: 'Cancel Rate', value: (report.cancelRate * 100).toFixed(1) + '%' },
    { metric: 'Avg Duration (min)', value: report.avgDurationMins },
  ]);
  styleHeaderRow(summary);

  const byStatus = wb.addWorksheet('By Status');
  byStatus.columns = [
    { header: 'Status', key: 'status', width: 20 },
    { header: 'Count', key: 'count', width: 12 },
  ];
  byStatus.addRows(report.byStatus);
  styleHeaderRow(byStatus);

  const byDay = wb.addWorksheet('By Day');
  byDay.columns = [
    { header: 'Date', key: 'date', width: 15 },
    { header: 'Count', key: 'count', width: 12 },
  ];
  byDay.addRows(report.byDay);
  styleHeaderRow(byDay);

  return wb.xlsx.writeBuffer() as unknown as Promise<Buffer>;
}

export async function buildPractitionersExcel(
  report: PractitionersReportResult | PractitionerDetailResult,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  // Detail mode
  if ('byDay' in report) {
    const detail = report as PractitionerDetailResult;
    const summary = wb.addWorksheet('Practitioner');
    summary.columns = [
      { header: 'Metric', key: 'metric', width: 30 },
      { header: 'Value', key: 'value', width: 30 },
    ];
    summary.addRows([
      { metric: 'Name', value: detail.name },
      { metric: 'Role', value: detail.role ?? '' },
      { metric: 'Bookings', value: detail.bookings },
      { metric: 'Completed', value: detail.completedBookings },
      { metric: 'Revenue (halalas)', value: detail.revenue },
      { metric: 'Avg Rating', value: detail.averageRating.toFixed(2) },
      { metric: 'Utilization', value: (detail.utilization * 100).toFixed(1) + '%' },
    ]);
    styleHeaderRow(summary);

    const byDay = wb.addWorksheet('By Day');
    byDay.columns = [
      { header: 'Date', key: 'date', width: 15 },
      { header: 'Bookings', key: 'bookings', width: 12 },
      { header: 'Revenue', key: 'revenue', width: 15 },
    ];
    byDay.addRows(detail.byDay);
    styleHeaderRow(byDay);
    return wb.xlsx.writeBuffer() as unknown as Promise<Buffer>;
  }

  const list = report as PractitionersReportResult;
  const summary = wb.addWorksheet('Summary');
  summary.columns = [
    { header: 'Metric', key: 'metric', width: 30 },
    { header: 'Value', key: 'value', width: 20 },
  ];
  summary.addRows([
    { metric: 'Active Practitioners', value: list.totalActive },
    { metric: 'Total Completed', value: list.totalCompleted },
    { metric: 'Avg Revenue', value: list.avgRevenue },
    { metric: 'Avg Utilization', value: (list.avgUtilization * 100).toFixed(1) + '%' },
    { metric: 'Avg Rating', value: list.avgRating.toFixed(2) },
  ]);
  styleHeaderRow(summary);

  const rows = wb.addWorksheet('Practitioners');
  rows.columns = [
    { header: 'Name', key: 'name', width: 25 },
    { header: 'Role', key: 'role', width: 20 },
    { header: 'Bookings', key: 'bookings', width: 12 },
    { header: 'Completed', key: 'completedBookings', width: 12 },
    { header: 'Completion %', key: 'completionRate', width: 14 },
    { header: 'Revenue', key: 'revenue', width: 15 },
    { header: 'Utilization %', key: 'utilization', width: 14 },
    { header: 'Avg Rating', key: 'averageRating', width: 12 },
  ];
  rows.addRows(
    list.rows.map((r) => ({
      ...r,
      completionRate: (r.completionRate * 100).toFixed(1) + '%',
      utilization: (r.utilization * 100).toFixed(1) + '%',
      averageRating: r.averageRating.toFixed(2),
    })),
  );
  styleHeaderRow(rows);

  return wb.xlsx.writeBuffer() as unknown as Promise<Buffer>;
}

export async function buildOverviewExcel(report: OverviewReportResult): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const summary = wb.addWorksheet('Summary');
  summary.columns = [
    { header: 'Metric', key: 'metric', width: 30 },
    { header: 'Value', key: 'value', width: 20 },
  ];
  summary.addRows([
    { metric: 'Total Revenue (halalas)', value: report.totalRevenue },
    { metric: 'Total Bookings', value: report.totalBookings },
    { metric: 'Completed Bookings', value: report.completedBookings },
    { metric: 'Completion Rate', value: (report.completionRate * 100).toFixed(1) + '%' },
    { metric: 'New Clients', value: report.newClients },
  ]);
  styleHeaderRow(summary);

  const trend = wb.addWorksheet('Trend');
  trend.columns = [
    { header: 'Date', key: 'date', width: 15 },
    { header: 'Revenue', key: 'revenue', width: 15 },
    { header: 'Bookings', key: 'bookings', width: 12 },
  ];
  trend.addRows(report.trend);
  styleHeaderRow(trend);

  const services = wb.addWorksheet('Top Services');
  services.columns = [
    { header: 'Service (AR)', key: 'nameAr', width: 25 },
    { header: 'Service (EN)', key: 'nameEn', width: 25 },
    { header: 'Bookings', key: 'count', width: 12 },
  ];
  services.addRows(report.topServices);
  styleHeaderRow(services);

  const practitioners = wb.addWorksheet('Top Practitioners');
  practitioners.columns = [
    { header: 'Name', key: 'name', width: 25 },
    { header: 'Revenue', key: 'revenue', width: 15 },
    { header: 'Bookings', key: 'bookings', width: 12 },
  ];
  practitioners.addRows(report.topPractitioners);
  styleHeaderRow(practitioners);

  return wb.xlsx.writeBuffer() as unknown as Promise<Buffer>;
}

export async function buildClientsExcel(report: ClientsReportResult): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const summary = wb.addWorksheet('Summary');
  summary.columns = [
    { header: 'Metric', key: 'metric', width: 30 },
    { header: 'Value', key: 'value', width: 20 },
  ];
  summary.addRows([
    { metric: 'Active Clients', value: report.total },
    { metric: 'New Clients', value: report.newClients },
    { metric: 'Returning Clients', value: report.returningClients },
    { metric: 'Retention Rate', value: (report.retentionRate * 100).toFixed(1) + '%' },
  ]);
  styleHeaderRow(summary);

  const gender = wb.addWorksheet('By Gender');
  gender.columns = [
    { header: 'Gender', key: 'gender', width: 15 },
    { header: 'Count', key: 'count', width: 12 },
  ];
  gender.addRows(report.byGender);
  styleHeaderRow(gender);

  const age = wb.addWorksheet('By Age');
  age.columns = [
    { header: 'Group', key: 'group', width: 15 },
    { header: 'Count', key: 'count', width: 12 },
  ];
  age.addRows(report.byAgeGroup);
  styleHeaderRow(age);

  const top = wb.addWorksheet('Top by Revenue');
  top.columns = [
    { header: 'Name', key: 'name', width: 25 },
    { header: 'Bookings', key: 'bookings', width: 12 },
    { header: 'Revenue', key: 'revenue', width: 15 },
  ];
  top.addRows(report.topByRevenue);
  styleHeaderRow(top);

  return wb.xlsx.writeBuffer() as unknown as Promise<Buffer>;
}

export async function buildServicesExcel(report: ServicesReportResult): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const rows = wb.addWorksheet('Services');
  rows.columns = [
    { header: 'Service (AR)', key: 'nameAr', width: 25 },
    { header: 'Service (EN)', key: 'nameEn', width: 25 },
    { header: 'Bookings', key: 'bookings', width: 12 },
    { header: 'Completed', key: 'completedBookings', width: 12 },
    { header: 'Revenue', key: 'revenue', width: 15 },
    { header: 'Cancel Rate', key: 'cancelRate', width: 14 },
    { header: 'Avg Rating', key: 'averageRating', width: 12 },
  ];
  rows.addRows(
    report.rows.map((r) => ({
      ...r,
      cancelRate: (r.cancelRate * 100).toFixed(1) + '%',
      averageRating: r.averageRating.toFixed(2),
    })),
  );
  styleHeaderRow(rows);
  return wb.xlsx.writeBuffer() as unknown as Promise<Buffer>;
}

export async function buildRatingsExcel(report: RatingsReportResult): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const summary = wb.addWorksheet('Summary');
  summary.columns = [
    { header: 'Metric', key: 'metric', width: 30 },
    { header: 'Value', key: 'value', width: 20 },
  ];
  summary.addRows([
    { metric: 'Average Score', value: report.averageScore.toFixed(2) },
    { metric: 'Total Ratings', value: report.totalRatings },
    { metric: 'Positive (≥4)', value: report.positiveCount },
    { metric: 'Negative (≤2)', value: report.negativeCount },
  ]);
  styleHeaderRow(summary);

  const dist = wb.addWorksheet('Distribution');
  dist.columns = [
    { header: 'Score', key: 'score', width: 8 },
    { header: 'Count', key: 'count', width: 12 },
  ];
  dist.addRows(report.distribution);
  styleHeaderRow(dist);

  const trend = wb.addWorksheet('Trend');
  trend.columns = [
    { header: 'Date', key: 'date', width: 15 },
    { header: 'Average', key: 'average', width: 12 },
    { header: 'Count', key: 'count', width: 10 },
  ];
  trend.addRows(report.trend);
  styleHeaderRow(trend);

  const neg = wb.addWorksheet('Negative Comments');
  neg.columns = [
    { header: 'Date', key: 'createdAt', width: 22 },
    { header: 'Client', key: 'clientName', width: 25 },
    { header: 'Practitioner', key: 'employeeName', width: 25 },
    { header: 'Service', key: 'serviceName', width: 25 },
    { header: 'Score', key: 'score', width: 8 },
    { header: 'Comment', key: 'comment', width: 50 },
  ];
  neg.addRows(report.recentNegative);
  styleHeaderRow(neg);

  return wb.xlsx.writeBuffer() as unknown as Promise<Buffer>;
}
