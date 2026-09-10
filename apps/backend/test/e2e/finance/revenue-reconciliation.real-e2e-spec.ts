/**
 * F3 revenue reconciliation against an isolated real Postgres database.
 *
 * Run with REAL_E2E_DATABASE_URL pointing at sawaa_report_test_ecfc after
 * migrations are applied. All rows are synthetic and cleaned up by id.
 */
import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma, PrismaClient, PaymentStatus } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaService } from '../../../src/infrastructure/database';
import { createRealE2eApp } from '../../helpers/create-real-e2e-app';
import { buildRevenueReport } from '../../../src/modules/ops/generate-report/revenue-report.builder';
import { revenueReportDateRange } from '../../../src/modules/ops/generate-report/revenue-report-query.helper';
import { GenerateReportHandler } from '../../../src/modules/ops/generate-report/generate-report.handler';

const describeRealE2e = process.env.REAL_E2E_DATABASE_URL ? describe : describe.skip;

describeRealE2e('F3 revenue reconciliation (real e2e)', () => {
  jest.setTimeout(60_000);

  let app: INestApplication;
  let prisma: PrismaService;
  const bookingIds: string[] = [];
  const invoiceIds: string[] = [];
  const paymentIds: string[] = [];
  const refundIds: string[] = [];
  const couponIds: string[] = [];
  const reportIds: string[] = [];

  const suffix = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  const branchA = `f3-branch-a-${suffix}`;
  const branchB = `f3-branch-b-${suffix}`;
  const edgeBranch = `f3-edge-branch-${suffix}`;
  const employeeA = `f3-employee-a-${suffix}`;
  const employeeB = `f3-employee-b-${suffix}`;
  const edgeEmployee = `f3-edge-employee-${suffix}`;
  const clientId = `f3-client-${suffix}`;
  const bookingNumber = () => 1_000_000_000 + Math.floor(Math.random() * 1_000_000_000);

  const createBooking = async (args: {
    branchId: string;
    employeeId: string;
    scheduledAt: Date;
  }) => {
    const id = randomUUID();
    await prisma.booking.create({
      data: {
        id,
        branchId: args.branchId,
        clientId,
        employeeId: args.employeeId,
        serviceId: randomUUID(),
        bookingType: 'INDIVIDUAL',
        deliveryType: 'IN_PERSON',
        status: 'COMPLETED',
        scheduledAt: args.scheduledAt,
        endsAt: new Date(args.scheduledAt.getTime() + 60 * 60 * 1_000),
        durationMins: 60,
        price: 0,
        bookingNumber: bookingNumber(),
      },
    });
    bookingIds.push(id);
    return id;
  };

  const createInvoice = async (args: {
    branchId: string;
    employeeId: string;
    bookingId: string;
    total: number;
  }) => {
    const invoice = await prisma.invoice.create({
      data: {
        branchId: args.branchId,
        clientId,
        employeeId: args.employeeId,
        bookingId: args.bookingId,
        subtotal: args.total,
        discountAmt: 0,
        vatRate: 0,
        vatAmt: 0,
        total: args.total,
        status: 'PAID',
      },
    });
    invoiceIds.push(invoice.id);
    return invoice.id;
  };

  const createPayment = async (args: {
    invoiceId: string;
    amount: number;
    status: PaymentStatus;
    createdAt: Date;
    method?: 'CASH' | 'MADA' | 'BANK_TRANSFER';
  }) => {
    const payment = await prisma.payment.create({
      data: {
        invoiceId: args.invoiceId,
        amount: args.amount,
        method: args.method ?? 'CASH',
        status: args.status,
        currency: 'SAR',
        createdAt: args.createdAt,
        processedAt: args.status === PaymentStatus.PENDING || args.status === PaymentStatus.FAILED
          ? null : args.createdAt,
      },
    });
    paymentIds.push(payment.id);
    return payment.id;
  };

  const createRefund = async (args: {
    invoiceId: string;
    paymentId: string;
    amount: number;
    status: 'COMPLETED' | 'PROCESSING' | 'FAILED' | 'PENDING_REVIEW';
    createdAt: Date;
  }) => {
    const refund = await prisma.refundRequest.create({
      data: {
        invoiceId: args.invoiceId,
        paymentId: args.paymentId,
        clientId,
        amount: args.amount,
        status: args.status,
        createdAt: args.createdAt,
        processedAt: args.status === 'COMPLETED' ? args.createdAt : null,
      },
    });
    refundIds.push(refund.id);
    return refund.id;
  };

  const createCoupon = async (code: string) => {
    const coupon = await prisma.coupon.create({
      data: {
        code,
        discountType: 'FIXED',
        discountValue: 500,
        serviceIds: [],
      },
    });
    couponIds.push(coupon.id);
    return coupon.id;
  };

  beforeAll(async () => {
    const result = await createRealE2eApp();
    app = result.app;
    prisma = result.prisma;
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.report.deleteMany({ where: { id: { in: reportIds } } });
    await prisma.refundRequest.deleteMany({ where: { id: { in: refundIds } } });
    await prisma.payment.deleteMany({ where: { id: { in: paymentIds } } });
    await prisma.couponRedemption.deleteMany({
      where: {
        OR: [
          { invoiceId: { in: invoiceIds } },
          { couponId: { in: couponIds } },
        ],
      },
    });
    await prisma.invoice.deleteMany({ where: { id: { in: invoiceIds } } });
    await prisma.coupon.deleteMany({ where: { id: { in: couponIds } } });
    await prisma.booking.deleteMany({ where: { id: { in: bookingIds } } });
    await app?.close();
  });

  it('reconciles settled states, refund states, methods, days, scopes, and coupons', async () => {
    const janBoundary = await createBooking({ branchId: branchA, employeeId: employeeA, scheduledAt: new Date('2026-01-16T08:00:00Z') });
    const janFull = await createBooking({ branchId: branchA, employeeId: employeeA, scheduledAt: new Date('2026-01-18T08:00:00Z') });
    const janCross = await createBooking({ branchId: branchA, employeeId: employeeB, scheduledAt: new Date('2026-01-20T08:00:00Z') });
    const janOther = await createBooking({ branchId: branchB, employeeId: employeeB, scheduledAt: new Date('2026-01-12T08:00:00Z') });
    const later = await createBooking({ branchId: branchA, employeeId: employeeA, scheduledAt: new Date('2026-01-30T08:00:00Z') });

    const boundaryInvoice = await createInvoice({ branchId: branchA, employeeId: employeeA, bookingId: janBoundary, total: 10_000 });
    const fullInvoice = await createInvoice({ branchId: branchA, employeeId: employeeA, bookingId: janFull, total: 5_000 });
    const crossInvoice = await createInvoice({ branchId: branchA, employeeId: employeeB, bookingId: janCross, total: 3_000 });
    const otherInvoice = await createInvoice({ branchId: branchB, employeeId: employeeB, bookingId: janOther, total: 7_000 });
    const laterInvoice = await createInvoice({ branchId: branchA, employeeId: employeeA, bookingId: later, total: 1_000 });
    const edgeBooking = await createBooking({ branchId: edgeBranch, employeeId: edgeEmployee, scheduledAt: new Date('2026-01-16T08:00:00Z') });
    const edgeInvoice = await createInvoice({ branchId: edgeBranch, employeeId: edgeEmployee, bookingId: edgeBooking, total: 1_500 });

    const boundaryPayment = await createPayment({
      invoiceId: boundaryInvoice,
      amount: 10_000,
      status: PaymentStatus.PARTIALLY_REFUNDED,
      createdAt: new Date('2026-01-15T22:30:00Z'),
      method: 'MADA',
    });
    const fullPayment = await createPayment({
      invoiceId: fullInvoice,
      amount: 5_000,
      status: PaymentStatus.REFUNDED,
      createdAt: new Date('2026-01-18T08:00:00Z'),
      method: 'CASH',
    });
    await createPayment({
      invoiceId: boundaryInvoice,
      amount: 4_000,
      status: PaymentStatus.PENDING,
      createdAt: new Date('2026-01-15T10:00:00Z'),
    });
    await createPayment({
      invoiceId: boundaryInvoice,
      amount: 3_000,
      status: PaymentStatus.FAILED,
      createdAt: new Date('2026-01-15T11:00:00Z'),
    });
    await createPayment({
      invoiceId: crossInvoice,
      amount: 3_000,
      status: PaymentStatus.COMPLETED,
      createdAt: new Date('2026-01-20T08:00:00Z'),
    });
    await createPayment({
      invoiceId: otherInvoice,
      amount: 7_000,
      status: PaymentStatus.COMPLETED,
      createdAt: new Date('2026-01-12T08:00:00Z'),
    });
    const laterPayment = await createPayment({
      invoiceId: laterInvoice,
      amount: 1_000,
      status: PaymentStatus.COMPLETED,
      createdAt: new Date('2026-01-30T08:00:00Z'),
    });

    await createRefund({ invoiceId: boundaryInvoice, paymentId: boundaryPayment, amount: 1_000, status: 'COMPLETED', createdAt: new Date('2026-01-20T08:00:00Z') });
    await createRefund({ invoiceId: fullInvoice, paymentId: fullPayment, amount: 5_000, status: 'COMPLETED', createdAt: new Date('2026-01-18T12:00:00Z') });
    await createRefund({ invoiceId: boundaryInvoice, paymentId: boundaryPayment, amount: 2_000, status: 'PROCESSING', createdAt: new Date('2026-01-21T08:00:00Z') });
    await createRefund({ invoiceId: boundaryInvoice, paymentId: boundaryPayment, amount: 500, status: 'FAILED', createdAt: new Date('2026-01-22T08:00:00Z') });
    await createRefund({ invoiceId: boundaryInvoice, paymentId: boundaryPayment, amount: 300, status: 'PENDING_REVIEW', createdAt: new Date('2026-01-23T08:00:00Z') });
    await createRefund({ invoiceId: laterInvoice, paymentId: laterPayment, amount: 1_000, status: 'COMPLETED', createdAt: new Date('2026-02-05T08:00:00Z') });

    // These rows sit immediately before, exactly on, and immediately after
    // the two Riyadh midnights around 2026-01-16. The explicit adjacent
    // windows below must assign the shared midnight to the second window.
    await createPayment({ invoiceId: edgeInvoice, amount: 100, status: PaymentStatus.COMPLETED, createdAt: new Date('2026-01-15T20:59:59.999Z') });
    await createPayment({ invoiceId: edgeInvoice, amount: 200, status: PaymentStatus.COMPLETED, createdAt: new Date('2026-01-15T21:00:00.000Z') });
    await createPayment({ invoiceId: edgeInvoice, amount: 300, status: PaymentStatus.COMPLETED, createdAt: new Date('2026-01-16T20:59:59.999Z') });
    await createPayment({ invoiceId: edgeInvoice, amount: 400, status: PaymentStatus.COMPLETED, createdAt: new Date('2026-01-16T21:00:00.000Z') });
    await createPayment({ invoiceId: edgeInvoice, amount: 500, status: PaymentStatus.COMPLETED, createdAt: new Date('2026-01-17T20:59:59.999Z') });

    const couponA = await createCoupon(`F3_A_${suffix}`);
    const couponB = await createCoupon(`F3_B_${suffix}`);
    await prisma.couponRedemption.create({ data: { couponId: couponA, invoiceId: boundaryInvoice, clientId, discount: 500, redeemedAt: new Date('2026-01-16T08:00:00Z') } });
    await prisma.couponRedemption.create({ data: { couponId: couponB, invoiceId: otherInvoice, clientId, discount: 700, redeemedAt: new Date('2026-01-16T08:00:00Z') } });

    const january = revenueReportDateRange('2026-01-01', '2026-01-31');
    const scoped = await buildRevenueReport(prisma, { ...january, branchId: branchA, employeeId: employeeA });
    expect(scoped.totalRevenue).toBe(16_000);
    expect(scoped.refundsTotal).toBe(6_000);
    expect(scoped.netRevenue).toBe(10_000);
    expect(scoped.byMethod.reduce((sum, row) => sum + row.amount, 0)).toBe(scoped.totalRevenue);
    expect(scoped.byDay.reduce((sum, row) => sum + row.amount, 0)).toBe(scoped.totalRevenue);
    expect(scoped.couponsUsed).toEqual([{ code: `F3_A_${suffix}`, uses: 1, discountAmount: 500, isActive: true }]);
    expect(scoped.byStatus).toEqual(expect.arrayContaining([
      { status: PaymentStatus.PARTIALLY_REFUNDED, amount: 10_000, count: 1 },
      { status: PaymentStatus.REFUNDED, amount: 5_000, count: 1 },
      { status: PaymentStatus.PENDING, amount: 4_000, count: 1 },
      { status: PaymentStatus.FAILED, amount: 3_000, count: 1 },
    ]));

    const branchOnly = await buildRevenueReport(prisma, { ...january, branchId: branchA });
    expect(branchOnly.totalRevenue).toBe(19_000);
    const employeeOnly = await buildRevenueReport(prisma, { ...january, employeeId: employeeA });
    expect(employeeOnly.totalRevenue).toBe(16_000);

    const boundary = revenueReportDateRange('2026-01-16', '2026-01-16');
    const boundaryReport = await buildRevenueReport(prisma, { ...boundary, branchId: branchA, employeeId: employeeA });
    expect(boundaryReport.totalRevenue).toBe(10_000);
    expect(boundaryReport.byDay).toEqual([{ date: '2026-01-16', amount: 10_000, count: 1 }]);

    const edgeDay = await buildRevenueReport(prisma, { ...boundary, branchId: edgeBranch, employeeId: edgeEmployee });
    expect(edgeDay.totalRevenue).toBe(500);
    expect(edgeDay.byDay).toEqual([{ date: '2026-01-16', amount: 500, count: 2 }]);

    const adjacentLeft = revenueReportDateRange('2026-01-15T21:00:00.000Z', '2026-01-16T21:00:00.000Z');
    const adjacentRight = revenueReportDateRange('2026-01-16T21:00:00.000Z', '2026-01-17T21:00:00.000Z');
    const leftReport = await buildRevenueReport(prisma, { ...adjacentLeft, branchId: edgeBranch, employeeId: edgeEmployee });
    const rightReport = await buildRevenueReport(prisma, { ...adjacentRight, branchId: edgeBranch, employeeId: edgeEmployee });
    expect(leftReport.totalRevenue).toBe(500);
    expect(rightReport.totalRevenue).toBe(900);
    expect(leftReport.totalRevenue + rightReport.totalRevenue).toBe(1_400);

    const fullRefund = revenueReportDateRange('2026-01-18', '2026-01-18');
    const fullRefundReport = await buildRevenueReport(prisma, { ...fullRefund, branchId: branchA, employeeId: employeeA });
    expect(fullRefundReport.totalRevenue).toBe(5_000);
    expect(fullRefundReport.refundsTotal).toBe(5_000);
    expect(fullRefundReport.netRevenue).toBe(0);

    const february = revenueReportDateRange('2026-02-05', '2026-02-05');
    const laterRefundReport = await buildRevenueReport(prisma, { ...february, branchId: branchA, employeeId: employeeA });
    expect(laterRefundReport.totalRevenue).toBe(0);
    expect(laterRefundReport.refundsTotal).toBe(1_000);
    expect(laterRefundReport.netRevenue).toBe(-1_000);
    expect(laterRefundReport.byDay).toEqual([]);

    const generated = await new GenerateReportHandler(prisma).execute({
      type: 'REVENUE',
      from: '2026-01-16',
      to: '2026-01-16',
      branchId: branchA,
      employeeId: employeeA,
      compareWithPrevious: true,
      requestedBy: `f3-${suffix}`,
    });
    reportIds.push(generated.reportId);
    expect((generated.data as { totalRevenue: number }).totalRevenue).toBe(10_000);
    expect((generated.data as { previous: { totalRevenue: number } }).previous.totalRevenue).toBe(0);
  });

  it('preserves unscoped orphan coupon redemptions and excludes them from scoped reports', async () => {
    const couponId = await createCoupon(`F3_ORPHAN_${suffix}`);
    await prisma.couponRedemption.create({
      data: {
        couponId,
        invoiceId: randomUUID(),
        clientId,
        discount: 750,
        redeemedAt: new Date('2026-01-16T08:00:00Z'),
      },
    });
    const january = revenueReportDateRange('2026-01-01', '2026-01-31');

    const unscoped = await buildRevenueReport(prisma, january);
    const scoped = await buildRevenueReport(prisma, {
      ...january,
      branchId: branchA,
      employeeId: employeeA,
    });

    expect(unscoped.couponsUsed).toContainEqual({
      code: `F3_ORPHAN_${suffix}`,
      uses: 1,
      discountAmount: 750,
      isActive: true,
    });
    expect(scoped.couponsUsed).not.toContainEqual(
      expect.objectContaining({ code: `F3_ORPHAN_${suffix}` }),
    );
  });
});
