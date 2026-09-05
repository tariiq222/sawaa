import { Prisma } from '@prisma/client';
import {
  buildBookingsReportQueries,
  buildRevenueReportQuery,
  revenueReportDateRange,
} from './revenue-report-query.helper';

describe('revenue report query helper', () => {
  it('covers date-only bounds across complete Riyadh days', () => {
    const range = revenueReportDateRange('2026-01-01', '2026-01-31');

    expect(range.from).toEqual(new Date('2026-01-01T00:00:00+03:00'));
    expect(range.toExclusive).toEqual(new Date('2026-02-01T00:00:00+03:00'));
  });

  it('orders reversed date-only bounds without changing their day semantics', () => {
    const range = revenueReportDateRange('2026-01-31', '2026-01-01');

    expect(range.from).toEqual(new Date('2026-01-01T00:00:00+03:00'));
    expect(range.toExclusive).toEqual(new Date('2026-02-01T00:00:00+03:00'));
  });

  it('preserves explicit instants instead of expanding them to calendar days', () => {
    const from = '2026-01-01T18:45:00.123Z';
    const to = '2026-01-02T03:10:00.456Z';
    const range = revenueReportDateRange(from, to);

    expect(range.from).toEqual(new Date(from));
    expect(range.toExclusive).toEqual(new Date(to));
  });

  it('keeps branch and employee bounds parameterized and applies them to invoice scope', () => {
    const from = new Date('2026-01-01T00:00:00Z');
    const toExclusive = new Date('2026-02-01T00:00:00Z');
    const query = buildRevenueReportQuery({ from, toExclusive, branchId: 'branch-1', employeeId: 'employee-1' });

    expect(query.paymentWhere).toEqual(expect.objectContaining({
      createdAt: { gte: from, lt: toExclusive },
      invoice: { is: { branchId: 'branch-1', employeeId: 'employee-1' } },
    }));
    expect(query.refundWhere).toEqual(expect.objectContaining({
      createdAt: { gte: from, lt: toExclusive },
      status: 'COMPLETED',
      invoice: { is: { branchId: 'branch-1', employeeId: 'employee-1' } },
    }));

    const sql = query.scopedRedemptions as unknown as { strings: readonly string[]; values: unknown[] };
    expect(sql.strings.join('')).toContain('JOIN "Invoice" i ON i."id" = r."invoiceId"');
    expect(sql.values).toEqual([from, toExclusive, 'branch-1', 'employee-1']);
    expect(sql.values).not.toContain(Prisma.raw('branch-1'));
  });

  it('keeps revenue booking totals half open while bookings reports remain inclusive', () => {
    const from = new Date('2026-01-01T00:00:00Z');
    const to = new Date('2026-02-01T00:00:00Z');
    const revenue = buildRevenueReportQuery({ from, toExclusive: to });
    const bookings = buildBookingsReportQueries({ from, to });

    expect(revenue.bookingAggregate.strings.join('')).toContain('b."scheduledAt" <');
    expect(bookings.summary.strings.join('')).toContain('b."scheduledAt" <=');
  });

  it('pins booking calendar and heatmap extraction to UTC', () => {
    const queries = buildBookingsReportQueries({
      from: new Date('2026-01-01T00:00:00Z'),
      to: new Date('2026-01-02T00:00:00Z'),
    });

    expect(queries.byDay.strings.join('')).toContain(
      '(b."scheduledAt" AT TIME ZONE \'UTC\' AT TIME ZONE \'UTC\')',
    );
    expect(queries.byHourDow.strings.join('')).toContain(
      'DOW FROM (b."scheduledAt" AT TIME ZONE \'UTC\' AT TIME ZONE \'UTC\')',
    );
    expect(queries.byHourDow.strings.join('')).toContain(
      'HOUR FROM (b."scheduledAt" AT TIME ZONE \'UTC\' AT TIME ZONE \'UTC\')',
    );
  });
});
