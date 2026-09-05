import { writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { PrismaService } from '../../src/infrastructure/database';
import { buildRevenueReport } from '../../src/modules/ops/generate-report/revenue-report.builder';
import { buildBookingsReport } from '../../src/modules/ops/generate-report/bookings-report.builder';

const EXPECTED_DB = 'sawaa_perf_test_ecfc';
const FROM = new Date('2026-01-01T00:00:00.000Z');
const TO_EXCLUSIVE = new Date('2026-03-01T00:00:00.000Z');
const TO_INCLUSIVE = new Date(TO_EXCLUSIVE.getTime() - 1);
const SIZES = [5_000, 50_000] as const;
const CONCURRENCIES = [1, 5, 10] as const;
const WAVES = 5;

type Timings = { samplesMs: number[]; p50Ms: number; p95Ms: number; peakRssBytes: number };

function percentile(values: number[], ratio: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length * ratio) - 1)] ?? 0;
}

async function currentDatabase(prisma: PrismaService): Promise<string> {
  const rows = await prisma.$queryRaw<Array<{ name: string }>>`SELECT current_database() AS name`;
  return rows[0]?.name ?? '';
}

async function resetFixture(prisma: PrismaService): Promise<void> {
  await prisma.$executeRawUnsafe(`
    DELETE FROM "RefundRequest" WHERE "id" LIKE 'o4-refund-%';
    DELETE FROM "Payment" WHERE "id" LIKE 'o4-payment-%';
    DELETE FROM "CouponRedemption" WHERE "id" LIKE 'o4-redemption-%';
    DELETE FROM "Invoice" WHERE "id" LIKE 'o4-invoice-%';
    DELETE FROM "Coupon" WHERE "id" LIKE 'o4-coupon-%';
    DELETE FROM "Booking" WHERE "id" LIKE 'o4-booking-%';
  `);
}

async function seedTo(prisma: PrismaService, size: number): Promise<void> {
  await prisma.$executeRawUnsafe(`
    INSERT INTO "Coupon" (
      "id", "code", "discountType", "discountValue", "usedCount", "serviceIds", "createdAt", "updatedAt"
    )
    SELECT 'o4-coupon-' || lpad(gs::text, 2, '0'), 'O4_' || lpad(gs::text, 2, '0'),
      'FIXED'::"DiscountType", 500, 0, ARRAY[]::text[], '2025-12-01'::timestamptz, '2025-12-01'::timestamptz
    FROM generate_series(1, 20) gs
    ON CONFLICT ("id") DO NOTHING;

    INSERT INTO "Booking" (
      "id", "branchId", "clientId", "employeeId", "serviceId", "bookingType", "deliveryType",
      "status", "scheduledAt", "endsAt", "durationMins", "price", "cancelReason", "bookingNumber",
      "createdAt", "updatedAt"
    )
    SELECT 'o4-booking-' || lpad(gs::text, 8, '0'),
      'o4-branch-' || (gs % 5), 'o4-client-' || (gs % 1000), 'o4-employee-' || (gs % 100),
      'o4-service-' || (gs % 20),
      (ARRAY['INDIVIDUAL','WALK_IN','GROUP']::"BookingType"[])[1 + (gs % 3)],
      (ARRAY['IN_PERSON','ONLINE']::"DeliveryType"[])[1 + (gs % 2)],
      (ARRAY['PENDING','PENDING_GROUP_FILL','AWAITING_PAYMENT','CONFIRMED','CANCELLED','COMPLETED','NO_SHOW','EXPIRED','CANCEL_REQUESTED','DEPOSIT_PAID']::"BookingStatus"[])[1 + (gs % 10)],
      '2026-01-01 00:00:00+00'::timestamptz + (gs - 1) * interval '1 minute',
      '2026-01-01 00:00:00+00'::timestamptz + (gs - 1) * interval '1 minute' + (30 + (gs % 4) * 15) * interval '1 minute',
      30 + (gs % 4) * 15, 10000 + (gs % 7) * 125,
      CASE WHEN gs % 10 = 4 THEN (ARRAY['CLIENT_REQUESTED','EMPLOYEE_UNAVAILABLE','NO_SHOW','SYSTEM_EXPIRED','OTHER',NULL]::"CancellationReason"[])[1 + (gs % 6)] ELSE NULL END,
      1700000000 + gs, now(), now()
    FROM generate_series(1, ${size}) gs
    ON CONFLICT ("id") DO NOTHING;

    INSERT INTO "Invoice" (
      "id", "branchId", "clientId", "employeeId", "bookingId", "subtotal", "discountAmt", "vatRate",
      "vatAmt", "total", "status", "createdAt", "updatedAt"
    )
    SELECT 'o4-invoice-' || lpad(gs::text, 8, '0'), 'o4-branch-' || (gs % 5),
      'o4-client-' || (gs % 1000), 'o4-employee-' || (gs % 100),
      'o4-booking-' || lpad(gs::text, 8, '0'), 10000 + (gs % 7) * 125, 0, 0, 0,
      10000 + (gs % 7) * 125, 'PAID'::"InvoiceStatus",
      '2026-01-01 00:00:00+00'::timestamptz + (gs - 1) * interval '1 minute', now()
    FROM generate_series(1, ${size}) gs
    ON CONFLICT ("id") DO NOTHING;

    INSERT INTO "Payment" (
      "id", "invoiceId", "amount", "refundedAmount", "currency", "method", "status", "processedAt", "createdAt", "updatedAt"
    )
    SELECT 'o4-payment-' || lpad(gs::text, 8, '0'), 'o4-invoice-' || lpad(gs::text, 8, '0'),
      10000 + (gs % 7) * 125,
      CASE WHEN gs % 12 = 0 THEN 10000 + (gs % 7) * 125 WHEN gs % 12 = 4 THEN 2500 ELSE 0 END,
      'SAR', (ARRAY['ONLINE_CARD','BANK_TRANSFER','CASH','COUPON','MADA','TABBY']::"PaymentMethod"[])[1 + (gs % 6)],
      (ARRAY['PENDING','PENDING_VERIFICATION','COMPLETED','FAILED','PARTIALLY_REFUNDED','REFUNDED']::"PaymentStatus"[])[1 + (gs % 6)],
      CASE WHEN gs % 6 IN (2,4,5) THEN '2026-01-01 00:00:00+00'::timestamptz + (gs - 1) * interval '1 minute' ELSE NULL END,
      '2026-01-01 00:00:00+00'::timestamptz + (gs - 1) * interval '1 minute', now()
    FROM generate_series(1, ${size}) gs
    ON CONFLICT ("id") DO NOTHING;

    INSERT INTO "RefundRequest" (
      "id", "invoiceId", "paymentId", "clientId", "amount", "status", "providerState", "processedAt", "createdAt", "updatedAt"
    )
    SELECT 'o4-refund-' || lpad(gs::text, 8, '0'), 'o4-invoice-' || lpad(gs::text, 8, '0'),
      'o4-payment-' || lpad(gs::text, 8, '0'), 'o4-client-' || (gs % 1000),
      CASE WHEN gs % 12 = 0 THEN 10000 + (gs % 7) * 125 ELSE 2500 END,
      CASE WHEN gs % 12 IN (0,4) THEN 'COMPLETED'::"RefundStatus" ELSE 'PROCESSING'::"RefundStatus" END,
      'BEFORE_CALL'::"RefundProviderState",
      CASE WHEN gs % 12 IN (0,4) THEN '2026-01-01 00:00:00+00'::timestamptz + (gs - 1) * interval '1 minute' ELSE NULL END,
      '2026-01-01 00:00:00+00'::timestamptz + (gs - 1) * interval '1 minute', now()
    FROM generate_series(4, ${size}, 4) gs
    ON CONFLICT ("id") DO NOTHING;

    INSERT INTO "CouponRedemption" (
      "id", "couponId", "invoiceId", "clientId", "discount", "redeemedAt"
    )
    SELECT 'o4-redemption-' || lpad(gs::text, 8, '0'), 'o4-coupon-' || lpad((1 + (gs % 20))::text, 2, '0'),
      'o4-invoice-' || lpad(gs::text, 8, '0'), 'o4-client-' || (gs % 1000), 500,
      '2026-01-01 00:00:00+00'::timestamptz + (gs - 1) * interval '1 minute'
    FROM generate_series(10, ${size}, 10) gs
    ON CONFLICT ("id") DO NOTHING;
  `);
  await prisma.$executeRawUnsafe('ANALYZE "Booking"; ANALYZE "Invoice"; ANALYZE "Payment"; ANALYZE "RefundRequest"; ANALYZE "CouponRedemption";');
}

async function measure(
  concurrency: number,
  operation: () => Promise<unknown>,
  ordinaryWork: () => Promise<unknown>,
): Promise<{ report: Timings; ordinaryWork: Timings }> {
  const reportSamples: number[] = [];
  const ordinarySamples: number[] = [];
  let peakRssBytes = process.memoryUsage().rss;
  const sampler = setInterval(() => { peakRssBytes = Math.max(peakRssBytes, process.memoryUsage().rss); }, 5);
  try {
    for (let wave = 0; wave < WAVES; wave += 1) {
      const reports = Array.from({ length: concurrency }, async () => {
        const start = performance.now();
        await operation();
        reportSamples.push(performance.now() - start);
      });
      const ordinary = Array.from({ length: concurrency }, async () => {
        const start = performance.now();
        await ordinaryWork();
        ordinarySamples.push(performance.now() - start);
      });
      await Promise.all([...reports, ...ordinary]);
    }
  } finally {
    clearInterval(sampler);
  }
  const summarize = (samplesMs: number[]): Timings => ({
    samplesMs,
    p50Ms: percentile(samplesMs, 0.5),
    p95Ms: percentile(samplesMs, 0.95),
    peakRssBytes,
  });
  return { report: summarize(reportSamples), ordinaryWork: summarize(ordinarySamples) };
}

async function explain(prisma: PrismaService, sql: string): Promise<unknown> {
  return prisma.$queryRawUnsafe(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${sql}`);
}

function byJson(a: unknown, b: unknown): number {
  return JSON.stringify(a).localeCompare(JSON.stringify(b));
}

function comparableRevenue(report: Awaited<ReturnType<typeof buildRevenueReport>>) {
  return {
    ...report,
    byMethod: [...report.byMethod].sort(byJson),
    byStatus: [...report.byStatus].sort(byJson),
    couponsUsed: [...report.couponsUsed].sort((a, b) => b.uses - a.uses || a.code.localeCompare(b.code)),
  };
}

function comparableBookings(report: Awaited<ReturnType<typeof buildBookingsReport>>) {
  return {
    ...report,
    byStatus: [...report.byStatus].sort(byJson),
    byType: [...report.byType].sort(byJson),
    byHourDow: [...report.byHourDow].sort((a, b) => a.dow - b.dow || a.hour - b.hour),
    byCancelReason: [...report.byCancelReason].sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason)),
  };
}

async function main(): Promise<void> {
  const outputArg = process.argv.find((arg) => arg.startsWith('--output='));
  const phaseArg = process.argv.find((arg) => arg.startsWith('--phase='));
  if (!outputArg || !phaseArg) throw new Error('Usage: --phase=baseline|after --output=/absolute/path.json');
  const output = outputArg.slice('--output='.length);
  const phase = phaseArg.slice('--phase='.length);
  if (phase !== 'baseline' && phase !== 'after') {
    throw new Error('--phase must be exactly baseline or after');
  }
  const prisma = new PrismaService();
  await prisma.$connect();
  try {
    const database = await currentDatabase(prisma);
    if (database !== EXPECTED_DB) throw new Error(`Refusing benchmark database: ${database}`);
    await resetFixture(prisma);
    const evidence: Record<string, unknown> = {
      phase,
      database,
      layer: 'direct accepted report builders with real Prisma/Postgres; mixed ordinary work is an indexed Booking count SQL query',
      fixture: { deterministic: true, sizes: SIZES, paymentsPerBooking: 1, variedBranches: 5, variedEmployees: 100, coupons: 20, refundPatterns: ['zero', 'partial', 'full'] },
      waves: WAVES,
      results: {},
    };
    for (const size of SIZES) {
      await seedTo(prisma, size);
      const params = { from: FROM, toExclusive: TO_EXCLUSIVE };
      const revenue = await buildRevenueReport(prisma, params);
      const bookings = await buildBookingsReport(prisma, { from: FROM, to: TO_INCLUSIVE });
      const scenarios: Record<string, unknown> = {};
      for (const concurrency of CONCURRENCIES) {
        const ordinaryWork = () => prisma.booking.count({ where: { employeeId: 'o4-employee-1', scheduledAt: { gte: FROM, lt: TO_EXCLUSIVE } } });
        scenarios[`revenue_c${concurrency}`] = await measure(concurrency, () => buildRevenueReport(prisma, params), ordinaryWork);
        scenarios[`bookings_c${concurrency}`] = await measure(concurrency, () => buildBookingsReport(prisma, { from: FROM, to: TO_INCLUSIVE }), ordinaryWork);
      }
      scenarios.explain = phase === 'after'
        ? {
            revenueStatusAggregate: await explain(prisma, `SELECT p."status"::text AS status, SUM(p."amount")::text AS amount, COUNT(*)::int AS count FROM "Payment" p JOIN "Invoice" i ON i."id"=p."invoiceId" WHERE p."createdAt">='2026-01-01T00:00:00Z' AND p."createdAt"<'2026-03-01T00:00:00Z' GROUP BY p."status"`),
            revenueMethodAggregate: await explain(prisma, `SELECT p."method"::text AS method, SUM(p."amount")::text AS amount, COUNT(*)::int AS count FROM "Payment" p JOIN "Invoice" i ON i."id"=p."invoiceId" WHERE p."createdAt">='2026-01-01T00:00:00Z' AND p."createdAt"<'2026-03-01T00:00:00Z' AND p."status" IN ('COMPLETED','PARTIALLY_REFUNDED','REFUNDED') GROUP BY p."method"`),
            revenueDayAggregate: await explain(prisma, `SELECT TO_CHAR((p."createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Riyadh')::date,'YYYY-MM-DD') AS date, SUM(p."amount")::text AS amount, COUNT(*)::int AS count FROM "Payment" p JOIN "Invoice" i ON i."id"=p."invoiceId" WHERE p."createdAt">='2026-01-01T00:00:00Z' AND p."createdAt"<'2026-03-01T00:00:00Z' AND p."status" IN ('COMPLETED','PARTIALLY_REFUNDED','REFUNDED') GROUP BY 1`),
            revenueRefundAggregate: await explain(prisma, `SELECT COALESCE(SUM(r."amount"),0)::text AS amount FROM "RefundRequest" r JOIN "Invoice" i ON i."id"=r."invoiceId" WHERE r."createdAt">='2026-01-01T00:00:00Z' AND r."createdAt"<'2026-03-01T00:00:00Z' AND r."status"='COMPLETED'`),
            revenueCouponAggregate: await explain(prisma, `SELECT r."couponId", COUNT(*)::int AS uses, SUM(r."discount")::text AS discount FROM "CouponRedemption" r WHERE r."redeemedAt">='2026-01-01T00:00:00Z' AND r."redeemedAt"<'2026-03-01T00:00:00Z' GROUP BY r."couponId"`),
            bookingsSummaryAggregate: await explain(prisma, `SELECT COUNT(*)::int AS total, COALESCE(ROUND(AVG(b."durationMins")),0)::int AS "avgDurationMins" FROM "Booking" b WHERE b."scheduledAt">='2026-01-01T00:00:00Z' AND b."scheduledAt"<='2026-02-28T23:59:59.999Z'`),
            bookingsDayAggregate: await explain(prisma, `SELECT TO_CHAR((b."scheduledAt" AT TIME ZONE 'UTC' AT TIME ZONE 'UTC')::date,'YYYY-MM-DD') AS date, COUNT(*)::int AS count FROM "Booking" b WHERE b."scheduledAt">='2026-01-01T00:00:00Z' AND b."scheduledAt"<='2026-02-28T23:59:59.999Z' GROUP BY 1`),
            bookingsHeatmapAggregate: await explain(prisma, `SELECT EXTRACT(DOW FROM (b."scheduledAt" AT TIME ZONE 'UTC' AT TIME ZONE 'UTC'))::int AS dow, EXTRACT(HOUR FROM (b."scheduledAt" AT TIME ZONE 'UTC' AT TIME ZONE 'UTC'))::int AS hour, COUNT(*)::int AS count FROM "Booking" b WHERE b."scheduledAt">='2026-01-01T00:00:00Z' AND b."scheduledAt"<='2026-02-28T23:59:59.999Z' GROUP BY 1,2`),
            bookingsCancelAggregate: await explain(prisma, `SELECT COALESCE(b."cancelReason"::text,'UNSPECIFIED') AS reason, COUNT(*)::int AS count FROM "Booking" b WHERE b."scheduledAt">='2026-01-01T00:00:00Z' AND b."scheduledAt"<='2026-02-28T23:59:59.999Z' AND b."status"='CANCELLED' GROUP BY 1`),
          }
        : {
            revenuePaymentsFullRows: await explain(prisma, `SELECT p."amount", p."method", p."status", p."createdAt" FROM "Payment" p WHERE p."createdAt" >= '2026-01-01T00:00:00Z' AND p."createdAt" < '2026-03-01T00:00:00Z'`),
            revenueRefundsFullRows: await explain(prisma, `SELECT r."amount" FROM "RefundRequest" r WHERE r."createdAt" >= '2026-01-01T00:00:00Z' AND r."createdAt" < '2026-03-01T00:00:00Z' AND r."status" = 'COMPLETED'`),
            bookingsFullRows: await explain(prisma, `SELECT b."scheduledAt", b."status", b."durationMins", b."cancelReason" FROM "Booking" b WHERE b."scheduledAt" >= '2026-01-01T00:00:00Z' AND b."scheduledAt" <= '2026-02-28T23:59:59.999Z'`),
          };
      (evidence.results as Record<string, unknown>)[String(size)] = {
        rowCounts: { bookings: size, payments: size, refunds: Math.floor(size / 4), redemptions: Math.floor(size / 10) },
        canonicalOutputs: { revenue: comparableRevenue(revenue), bookings: comparableBookings(bookings) },
        scenarios,
      };
    }
    await writeFile(output, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
