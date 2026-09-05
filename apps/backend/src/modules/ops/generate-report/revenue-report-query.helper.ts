import { Prisma, RefundStatus } from '@prisma/client';
import { startOfDayInTz } from '../../../common/helpers/date-tz.helper';
import { SETTLED_PAYMENT_STATUSES } from '../../finance/invoice-balance.helper';

export interface RevenueReportParams {
  from: Date;
  toExclusive: Date;
  branchId?: string;
  employeeId?: string;
}

export interface RevenueReportQueries {
  paymentStatusAggregate: Prisma.Sql;
  paymentMethodAggregate: Prisma.Sql;
  paymentDayAggregate: Prisma.Sql;
  refundAggregate: Prisma.Sql;
  bookingAggregate: Prisma.Sql;
  couponAggregate: Prisma.Sql;
  /** Backward-compatible name used by the F3 query helper tests. */
  scopedRedemptions: Prisma.Sql;
}

/** Preserve explicit instants; date-only report inputs cover whole Riyadh days. */
export function revenueReportDateRange(fromInput: string, toInput: string) {
  const [fromValue, toValue] = new Date(fromInput) <= new Date(toInput)
    ? [fromInput, toInput] : [toInput, fromInput];
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/;
  const toExclusive = dateOnly.test(toValue)
    ? new Date(startOfDayInTz(toValue)!.getTime() + 24 * 60 * 60 * 1_000)
    : new Date(toValue);
  return {
    from: dateOnly.test(fromValue) ? startOfDayInTz(fromValue)! : new Date(fromValue),
    toExclusive,
  };
}

export function buildRevenueReportQuery(params: RevenueReportParams) {
  const { from, toExclusive, branchId, employeeId } = params;
  const invoiceWhere: Prisma.InvoiceWhereInput = {
    ...(branchId ? { branchId } : {}),
    ...(employeeId ? { employeeId } : {}),
  };
  const hasInvoiceFilter = Boolean(branchId || employeeId);
  const invoiceRelation = hasInvoiceFilter ? { invoice: { is: invoiceWhere } } : {};
  const paymentWhere: Prisma.PaymentWhereInput = {
    createdAt: { gte: from, lt: toExclusive }, ...invoiceRelation,
  };
  const refundWhere: Prisma.RefundRequestWhereInput = {
    createdAt: { gte: from, lt: toExclusive },
    status: RefundStatus.COMPLETED, ...invoiceRelation,
  };
  const bookingWhere: Prisma.BookingWhereInput = {
    scheduledAt: { gte: from, lt: toExclusive },
    ...(branchId ? { branchId } : {}),
    ...(employeeId ? { employeeId } : {}),
  };

  const paymentScope = Prisma.sql`
    FROM "Payment" p
    JOIN "Invoice" i ON i."id" = p."invoiceId"
    WHERE p."createdAt" >= ${from} AND p."createdAt" < ${toExclusive}
      ${branchId ? Prisma.sql`AND i."branchId" = ${branchId}` : Prisma.empty}
      ${employeeId ? Prisma.sql`AND i."employeeId" = ${employeeId}` : Prisma.empty}
  `;
  const settledStatuses = Prisma.join(SETTLED_PAYMENT_STATUSES);
  const paymentStatusAggregate = Prisma.sql`
    SELECT p."status"::text AS "status",
      COALESCE(SUM(p."amount"), 0)::text AS "amount",
      COUNT(*)::int AS "count"
    ${paymentScope}
    GROUP BY p."status"
    ORDER BY p."status"::text ASC
  `;
  const paymentMethodAggregate = Prisma.sql`
    SELECT p."method"::text AS "method",
      COALESCE(SUM(p."amount"), 0)::text AS "amount",
      COUNT(*)::int AS "count"
    ${paymentScope}
      AND p."status" IN (${settledStatuses})
    GROUP BY p."method"
    ORDER BY p."method"::text ASC
  `;
  const paymentDayAggregate = Prisma.sql`
    SELECT TO_CHAR(
      (p."createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Riyadh')::date,
      'YYYY-MM-DD'
    ) AS "date",
      COALESCE(SUM(p."amount"), 0)::text AS "amount",
      COUNT(*)::int AS "count"
    ${paymentScope}
      AND p."status" IN (${settledStatuses})
    GROUP BY 1
    ORDER BY 1 ASC
  `;
  const refundAggregate = Prisma.sql`
    SELECT COALESCE(SUM(r."amount"), 0)::text AS "amount"
    FROM "RefundRequest" r
    JOIN "Invoice" i ON i."id" = r."invoiceId"
    WHERE r."createdAt" >= ${from} AND r."createdAt" < ${toExclusive}
      AND r."status" = ${RefundStatus.COMPLETED}
      ${branchId ? Prisma.sql`AND i."branchId" = ${branchId}` : Prisma.empty}
      ${employeeId ? Prisma.sql`AND i."employeeId" = ${employeeId}` : Prisma.empty}
  `;
  const bookingAggregate = Prisma.sql`
    SELECT COUNT(*)::int AS "total",
      COALESCE(ROUND(AVG(b."durationMins")), 0)::int AS "avgDurationMins"
    FROM "Booking" b
    WHERE b."scheduledAt" >= ${from} AND b."scheduledAt" < ${toExclusive}
      ${branchId ? Prisma.sql`AND b."branchId" = ${branchId}` : Prisma.empty}
      ${employeeId ? Prisma.sql`AND b."employeeId" = ${employeeId}` : Prisma.empty}
  `;
  const couponAggregate = Prisma.sql`
    SELECT r."couponId" AS "couponId",
      COUNT(*)::int AS "uses",
      COALESCE(SUM(r."discount"), 0)::text AS "discount"
    FROM "CouponRedemption" r
    ${hasInvoiceFilter ? Prisma.sql`JOIN "Invoice" i ON i."id" = r."invoiceId"` : Prisma.empty}
    WHERE r."redeemedAt" >= ${from} AND r."redeemedAt" < ${toExclusive}
      ${branchId ? Prisma.sql`AND i."branchId" = ${branchId}` : Prisma.empty}
      ${employeeId ? Prisma.sql`AND i."employeeId" = ${employeeId}` : Prisma.empty}
    GROUP BY r."couponId"
    ORDER BY "uses" DESC, r."couponId" ASC
  `;
  return {
    paymentWhere,
    refundWhere,
    bookingWhere,
    hasInvoiceFilter,
    paymentStatusAggregate,
    paymentMethodAggregate,
    paymentDayAggregate,
    refundAggregate,
    bookingAggregate,
    couponAggregate,
    scopedRedemptions: couponAggregate,
  } satisfies RevenueReportQueries & {
    paymentWhere: Prisma.PaymentWhereInput;
    refundWhere: Prisma.RefundRequestWhereInput;
    bookingWhere: Prisma.BookingWhereInput;
    hasInvoiceFilter: boolean;
  };
}

export interface BookingsReportQueries {
  summary: Prisma.Sql;
  byStatus: Prisma.Sql;
  byType: Prisma.Sql;
  byDay: Prisma.Sql;
  byHourDow: Prisma.Sql;
  byCancelReason: Prisma.Sql;
}

export function buildBookingsReportQueries(params: {
  from: Date;
  to: Date;
  branchId?: string;
}) : BookingsReportQueries {
  const { from, to, branchId } = params;
  const scope = Prisma.sql`
    FROM "Booking" b
    WHERE b."scheduledAt" >= ${from} AND b."scheduledAt" <= ${to}
      ${branchId ? Prisma.sql`AND b."branchId" = ${branchId}` : Prisma.empty}
  `;
  return {
    summary: Prisma.sql`
      SELECT COUNT(*)::int AS "total",
        COALESCE(ROUND(AVG(b."durationMins")), 0)::int AS "avgDurationMins"
      ${scope}
    `,
    byStatus: Prisma.sql`
      SELECT b."status"::text AS "status", COUNT(*)::int AS "count"
      ${scope}
      GROUP BY b."status"
      ORDER BY b."status"::text ASC
    `,
    byType: Prisma.sql`
      SELECT b."bookingType"::text AS "type", COUNT(*)::int AS "count"
      ${scope}
      GROUP BY b."bookingType"
      ORDER BY b."bookingType"::text ASC
    `,
    byDay: Prisma.sql`
      SELECT TO_CHAR(
        (b."scheduledAt" AT TIME ZONE 'UTC' AT TIME ZONE 'UTC')::date,
        'YYYY-MM-DD'
      ) AS "date",
        COUNT(*)::int AS "count"
      ${scope}
      GROUP BY 1
      ORDER BY 1 ASC
    `,
    byHourDow: Prisma.sql`
      SELECT EXTRACT(
          DOW FROM (b."scheduledAt" AT TIME ZONE 'UTC' AT TIME ZONE 'UTC')
        )::int AS "dow",
        EXTRACT(
          HOUR FROM (b."scheduledAt" AT TIME ZONE 'UTC' AT TIME ZONE 'UTC')
        )::int AS "hour",
        COUNT(*)::int AS "count"
      ${scope}
      GROUP BY 1, 2
      ORDER BY 1 ASC, 2 ASC
    `,
    byCancelReason: Prisma.sql`
      SELECT COALESCE(b."cancelReason"::text, 'UNSPECIFIED') AS "reason",
        COUNT(*)::int AS "count"
      ${scope}
        AND b."status" = 'CANCELLED'
      GROUP BY 1
      ORDER BY "count" DESC, "reason" ASC
    `,
  };
}
