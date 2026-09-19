/**
 * Package refund ledger — real-DB coverage.
 *
 * This spec calls the refund handler against Postgres rather than mocking the
 * transaction client. It deliberately seeds only the rows the handler owns;
 * package/client/branch references are cross bounded-context ids and therefore
 * do not need unrelated fixture graphs.
 */

import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import {
  InvoiceStatus,
  PackagePurchaseStatus,
  PackageRefundEventSource,
  PackageRefundType,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  RefundStatus,
} from "@prisma/client";
import { randomUUID } from "node:crypto";
import { AppModule } from "../../../src/app.module";
import { RlsTransactionService } from "../../../src/common/database/rls-transaction";
import { PrismaService } from "../../../src/infrastructure/database";
import { EventBusService } from "../../../src/infrastructure/events";
import { MoyasarApiClient } from "../../../src/modules/finance/moyasar-api/moyasar-api.client";
import { RefundPackagePurchaseHandler } from "../../../src/modules/finance/package-purchases/refund-package-purchase/refund-package-purchase.handler";
import { buildRefundedPackagesReport } from "../../../src/modules/ops/generate-report/refunded-packages-report.builder";
import { getRealE2eDatabaseUrl } from "../../helpers/create-real-e2e-app";
import {
  runBackfill,
  type TransitionPrismaClient,
} from "../../../scripts/backfill-package-refund-events";

const describeRealE2e = process.env.REAL_E2E_DATABASE_URL
  ? describe
  : describe.skip;

describeRealE2e("Package refund ledger — real DB", () => {
  jest.setTimeout(60_000);

  let app: INestApplication;
  let prisma: PrismaService;
  let refundHandler: RefundPackagePurchaseHandler;

  const purchaseIds: string[] = [];
  const invoiceIds: string[] = [];
  const paymentIds: string[] = [];

  beforeAll(async () => {
    process.env.DATABASE_URL = getRealE2eDatabaseUrl();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(MoyasarApiClient)
      .useValue({
        createPayment: jest.fn(),
        createRefund: jest.fn(),
        getPaymentStatus: jest.fn(),
        getRefundStatus: jest.fn(),
        invalidate: jest.fn(),
        toPaymentStatus: jest.fn(),
        toPaymentMethod: jest.fn(),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    refundHandler = app.get(RefundPackagePurchaseHandler);
    await prisma.$queryRaw`SELECT 1`;
  });

  afterAll(async () => {
    if (!prisma) return;

    // Events have no FK to RefundRequest, so remove them first. The remaining
    // rows are then deleted in FK-safe order and scoped to this spec's ids.
    await prisma.packageRefundEvent
      .deleteMany({ where: { purchaseId: { in: purchaseIds } } })
      .catch(() => undefined);
    await prisma.refundRequest
      .deleteMany({ where: { paymentId: { in: paymentIds } } })
      .catch(() => undefined);
    await prisma.payment
      .deleteMany({ where: { id: { in: paymentIds } } })
      .catch(() => undefined);
    await prisma.invoice
      .deleteMany({ where: { id: { in: invoiceIds } } })
      .catch(() => undefined);
    await prisma.packagePurchase
      .deleteMany({ where: { id: { in: purchaseIds } } })
      .catch(() => undefined);
    await app.close();
  });

  async function seedPurchase(options: {
    amountPaid: number;
    withInvoice?: boolean;
    withPayment?: boolean;
    totalQuantity?: number;
    usedQuantity?: number;
    reservedQuantity?: number;
  }) {
    const purchaseId = randomUUID();
    const amount = new Prisma.Decimal(options.amountPaid);
    await prisma.packagePurchase.create({
      data: {
        id: purchaseId,
        packageId: randomUUID(),
        clientId: randomUUID(),
        branchId: randomUUID(),
        status: PackagePurchaseStatus.ACTIVE,
        subtotalSnapshot: amount,
        discountSnapshot: new Prisma.Decimal(0),
        amountPaid: amount,
        paidAt: new Date(),
      },
    });
    purchaseIds.push(purchaseId);

    const credit = await prisma.packageCredit.create({
      data: {
        purchaseId,
        unitPriceSnapshot: amount,
        totalQuantity: options.totalQuantity ?? 3,
        usedQuantity: options.usedQuantity ?? 0,
        reservedQuantity: options.reservedQuantity ?? 0,
      },
    });

    let invoiceId: string | undefined;
    let paymentId: string | undefined;
    if (options.withInvoice !== false) {
      invoiceId = randomUUID();
      await prisma.invoice.create({
        data: {
          id: invoiceId,
          branchId: randomUUID(),
          clientId: randomUUID(),
          employeeId: randomUUID(),
          packagePurchaseId: purchaseId,
          subtotal: amount,
          discountAmt: new Prisma.Decimal(0),
          vatRate: new Prisma.Decimal(0),
          vatAmt: new Prisma.Decimal(0),
          total: amount,
          currency: "SAR",
          status: InvoiceStatus.PAID,
          issuedAt: new Date(),
          paidAt: new Date(),
        },
      });
      invoiceIds.push(invoiceId);

      if (options.withPayment !== false) {
        paymentId = randomUUID();
        await prisma.payment.create({
          data: {
            id: paymentId,
            invoiceId,
            amount,
            currency: "SAR",
            method: PaymentMethod.CASH,
            status: PaymentStatus.COMPLETED,
            processedAt: new Date(),
          },
        });
        paymentIds.push(paymentId);
      }
    }

    return { purchaseId, creditId: credit.id, invoiceId, paymentId };
  }

  function command(purchaseId: string, refundAmount: number, notes = "real ledger") {
    return {
      purchaseId,
      refundAmount,
      notes,
      userId: "real-e2e-manager",
    };
  }

  function scopedBackfill(purchaseIdsForRun: string[], readOnly = false): TransitionPrismaClient {
    const transaction: TransitionPrismaClient["$transaction"] = readOnly
      ? async (fn) =>
          prisma.$transaction(
            async (tx) => {
              await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
              return fn(tx as never);
            },
            { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
          )
      : (prisma.$transaction.bind(prisma) as TransitionPrismaClient["$transaction"]);

    return {
      packagePurchase: {
        findMany: async () => purchaseIdsForRun.map((id) => ({ id })),
      },
      $transaction: transaction,
    };
  }

  it("records linked partials and a closing full refund with exact amounts while preserving partial capacity", async () => {
    const seeded = await seedPurchase({
      amountPaid: 100_000,
      totalQuantity: 4,
      usedQuantity: 1,
      reservedQuantity: 1,
    });

    await refundHandler.execute(command(seeded.purchaseId, 20_000, "first"));
    let purchase = await prisma.packagePurchase.findUnique({ where: { id: seeded.purchaseId } });
    let credit = await prisma.packageCredit.findUnique({ where: { id: seeded.creditId } });
    expect(purchase?.status).toBe(PackagePurchaseStatus.ACTIVE);
    expect(Number(purchase?.refundAmount)).toBe(20_000);
    expect(credit).toMatchObject({ totalQuantity: 4, usedQuantity: 1, reservedQuantity: 1 });

    await refundHandler.execute(command(seeded.purchaseId, 30_000, "second"));
    purchase = await prisma.packagePurchase.findUnique({ where: { id: seeded.purchaseId } });
    credit = await prisma.packageCredit.findUnique({ where: { id: seeded.creditId } });
    expect(purchase?.status).toBe(PackagePurchaseStatus.ACTIVE);
    expect(Number(purchase?.refundAmount)).toBe(50_000);
    expect(credit).toMatchObject({ totalQuantity: 4, usedQuantity: 1, reservedQuantity: 1 });

    await refundHandler.execute(command(seeded.purchaseId, 50_000, "closing"));
    purchase = await prisma.packagePurchase.findUnique({ where: { id: seeded.purchaseId } });
    credit = await prisma.packageCredit.findUnique({ where: { id: seeded.creditId } });
    expect(purchase?.status).toBe(PackagePurchaseStatus.REFUNDED);
    expect(Number(purchase?.refundAmount)).toBe(100_000);
    expect(credit).toMatchObject({ totalQuantity: 4, usedQuantity: 4, reservedQuantity: 0 });

    const events = await prisma.packageRefundEvent.findMany({
      where: { purchaseId: seeded.purchaseId },
      orderBy: { createdAt: "asc" },
    });
    expect(events).toHaveLength(3);
    expect(events.map((event) => Number(event.amount)).sort((a, b) => a - b)).toEqual([
      20_000,
      30_000,
      50_000,
    ]);
    expect(events.map((event) => Number(event.cumulativeRefundAmount)).sort((a, b) => a - b)).toEqual([
      20_000,
      50_000,
      100_000,
    ]);
    expect(events.every((event) => event.source === PackageRefundEventSource.LIVE)).toBe(true);
    expect(events.every((event) => event.sourceRefundRequestId !== null)).toBe(true);
    expect(events.every((event) => event.refundType === PackageRefundType.PARTIAL || event.refundType === PackageRefundType.FULL)).toBe(true);
    const requestIds = new Set(
      (
        await prisma.refundRequest.findMany({
          where: { paymentId: seeded.paymentId },
          select: { id: true, amount: true, status: true },
        })
      ).map((request) => request.id),
    );
    expect(requestIds.size).toBe(3);
    expect(events.every((event) => requestIds.has(event.sourceRefundRequestId!))).toBe(true);
  });

  it("records no-invoice refunds and zero-money full cancellations as visible events without requests", async () => {
    const requestCountBefore = await prisma.refundRequest.count();
    const noInvoice = await seedPurchase({ amountPaid: 40_000, withInvoice: false });
    await refundHandler.execute(command(noInvoice.purchaseId, 40_000, "cash return"));
    const zero = await seedPurchase({ amountPaid: 0, withInvoice: false });
    await refundHandler.execute(command(zero.purchaseId, 0, "cancellation"));

    const events = await prisma.packageRefundEvent.findMany({
      where: { purchaseId: { in: [noInvoice.purchaseId, zero.purchaseId] } },
      orderBy: { createdAt: "asc" },
    });
    expect(events).toHaveLength(2);
    expect(events.map((event) => Number(event.amount)).sort((a, b) => a - b)).toEqual([0, 40_000]);
    expect(events.every((event) => event.sourceRefundRequestId === null)).toBe(true);
    expect(events.find((event) => event.purchaseId === noInvoice.purchaseId)?.refundType).toBe(PackageRefundType.FULL);
    expect(events.find((event) => event.purchaseId === zero.purchaseId)?.refundType).toBe(PackageRefundType.FULL);
    expect(
      await prisma.packagePurchase.count({
        where: { id: { in: [noInvoice.purchaseId, zero.purchaseId] }, status: PackagePurchaseStatus.REFUNDED },
      }),
    ).toBe(2);
    expect(await prisma.refundRequest.count()).toBe(requestCountBefore);
  });

  it("rolls back purchase, credit, invoice, payment, request, and event writes when ledger insertion fails", async () => {
    const seeded = await seedPurchase({ amountPaid: 30_000 });
    const before = await Promise.all([
      prisma.packagePurchase.findUnique({ where: { id: seeded.purchaseId } }),
      prisma.packageCredit.findUnique({ where: { id: seeded.creditId } }),
      prisma.invoice.findUnique({ where: { id: seeded.invoiceId! } }),
      prisma.payment.findUnique({ where: { id: seeded.paymentId! } }),
      prisma.refundRequest.count({ where: { paymentId: seeded.paymentId } }),
      prisma.packageRefundEvent.count({ where: { purchaseId: seeded.purchaseId } }),
    ]);

    const realRls = app.get(RlsTransactionService);
    const failingRls = {
      withTransaction: (fn: (tx: Prisma.TransactionClient) => Promise<unknown>) =>
        realRls.withTransaction((tx) => {
          const failingEvents = new Proxy(tx.packageRefundEvent, {
            get(target, property, receiver) {
              if (property === "create") {
                return async () => {
                  throw new Error("forced ledger insertion failure");
                };
              }
              return Reflect.get(target, property, receiver);
            },
          });
          const wrappedTx = new Proxy(tx, {
            get(target, property, receiver) {
              if (property === "packageRefundEvent") return failingEvents;
              return Reflect.get(target, property, receiver);
            },
          });
          return fn(wrappedTx);
        }),
    };
    const failingHandler = new RefundPackagePurchaseHandler(
      prisma,
      failingRls as never,
      app.get(EventBusService),
    );

    await expect(failingHandler.execute(command(seeded.purchaseId, 30_000))).rejects.toThrow(
      "forced ledger insertion failure",
    );

    const after = await Promise.all([
      prisma.packagePurchase.findUnique({ where: { id: seeded.purchaseId } }),
      prisma.packageCredit.findUnique({ where: { id: seeded.creditId } }),
      prisma.invoice.findUnique({ where: { id: seeded.invoiceId! } }),
      prisma.payment.findUnique({ where: { id: seeded.paymentId! } }),
      prisma.refundRequest.count({ where: { paymentId: seeded.paymentId } }),
      prisma.packageRefundEvent.count({ where: { purchaseId: seeded.purchaseId } }),
    ]);
    expect(after).toEqual(before);
  });

  it("serializes concurrent full refunds so one succeeds and one event/request is committed", async () => {
    const seeded = await seedPurchase({ amountPaid: 50_000, totalQuantity: 1 });
    const results = await Promise.allSettled([
      refundHandler.execute(command(seeded.purchaseId, 50_000, "race-a")),
      refundHandler.execute(command(seeded.purchaseId, 50_000, "race-b")),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect(await prisma.packageRefundEvent.count({ where: { purchaseId: seeded.purchaseId } })).toBe(1);
    expect(await prisma.refundRequest.count({ where: { paymentId: seeded.paymentId } })).toBe(1);
    const purchase = await prisma.packagePurchase.findUnique({ where: { id: seeded.purchaseId } });
    const credit = await prisma.packageCredit.findUnique({ where: { id: seeded.creditId } });
    expect(purchase?.status).toBe(PackagePurchaseStatus.REFUNDED);
    expect(Number(purchase?.refundAmount)).toBe(50_000);
    expect(credit).toMatchObject({ usedQuantity: 1, reservedQuantity: 0 });
  });

  it("does not duplicate a LIVE event when the historical backfill is rerun", async () => {
    const seeded = await seedPurchase({ amountPaid: 25_000 });
    await refundHandler.execute(command(seeded.purchaseId, 25_000, "already live"));
    const beforeCount = await prisma.packageRefundEvent.count({ where: { purchaseId: seeded.purchaseId } });

    const scopedPrisma = scopedBackfill([seeded.purchaseId]);
    const first = await runBackfill(scopedPrisma, { dryRun: false });
    const second = await runBackfill(scopedPrisma, { dryRun: false });

    expect(first).toMatchObject({ importedRequestCount: 0, aggregateCount: 0, findings: [] });
    expect(second).toMatchObject({ importedRequestCount: 0, aggregateCount: 0, findings: [] });
    expect(await prisma.packageRefundEvent.count({ where: { purchaseId: seeded.purchaseId } })).toBe(beforeCount);
  });

  it("keeps positive residuals undated despite refundedAt, while preserving a provable dated zero terminal event", async () => {
    const knownDate = new Date("2026-08-20T12:34:56.000Z");
    const knownDatePurchase = await seedPurchase({ amountPaid: 45_000, withInvoice: false });
    const unknownDatePurchase = await seedPurchase({ amountPaid: 7_000, withInvoice: false });
    const datedZeroPurchase = await seedPurchase({ amountPaid: 0, withInvoice: false });
    await prisma.packagePurchase.update({
      where: { id: knownDatePurchase.purchaseId },
      data: {
        status: PackagePurchaseStatus.REFUNDED,
        refundAmount: new Prisma.Decimal(45_000),
        refundedAt: knownDate,
      },
    });
    await prisma.packagePurchase.update({
      where: { id: unknownDatePurchase.purchaseId },
      data: {
        status: PackagePurchaseStatus.REFUNDED,
        refundAmount: new Prisma.Decimal(7_000),
        refundedAt: null,
      },
    });
    await prisma.packagePurchase.update({
      where: { id: datedZeroPurchase.purchaseId },
      data: {
        status: PackagePurchaseStatus.REFUNDED,
        refundAmount: new Prisma.Decimal(0),
        refundedAt: knownDate,
      },
    });

    const beforeDryRun = await prisma.packageRefundEvent.findMany({
      where: { purchaseId: { in: [knownDatePurchase.purchaseId, unknownDatePurchase.purchaseId, datedZeroPurchase.purchaseId] } },
      orderBy: { id: "asc" },
    });
    const dryRun = await runBackfill(
      scopedBackfill([knownDatePurchase.purchaseId, unknownDatePurchase.purchaseId, datedZeroPurchase.purchaseId], true),
      { dryRun: true },
    );
    expect(dryRun).toMatchObject({
      purchasesConsidered: 3,
      aggregateCount: 3,
      residualHalalas: 52_000,
      undatedPurchaseCount: 2,
      findings: [],
    });
    expect(
      await prisma.packageRefundEvent.findMany({
        where: { purchaseId: { in: [knownDatePurchase.purchaseId, unknownDatePurchase.purchaseId, datedZeroPurchase.purchaseId] } },
        orderBy: { id: "asc" },
      }),
    ).toEqual(beforeDryRun);

    const legacyReport = await buildRefundedPackagesReport(prisma, {
      from: new Date("2026-08-01T00:00:00.000Z"),
      to: new Date("2026-08-31T23:59:59.999Z"),
    });
    expect(legacyReport.historyMode).toBe("LEGACY");
    if (legacyReport.historyMode !== "LEGACY") throw new Error("expected legacy report");
    expect(legacyReport.items.some((item) => item.purchaseId === knownDatePurchase.purchaseId)).toBe(true);
    expect(legacyReport.items.find((item) => item.purchaseId === knownDatePurchase.purchaseId)).toMatchObject({
      refundAmount: 45_000,
      refundedAt: knownDate.toISOString(),
    });

    const applied = await runBackfill(
      scopedBackfill([knownDatePurchase.purchaseId, unknownDatePurchase.purchaseId, datedZeroPurchase.purchaseId]),
      { dryRun: false },
    );
    expect(applied).toMatchObject({
      purchasesConsidered: 3,
      aggregateCount: 3,
      residualHalalas: 52_000,
      undatedPurchaseCount: 2,
      findings: [],
    });
    const appliedEvents = await prisma.packageRefundEvent.findMany({
      where: { purchaseId: { in: [knownDatePurchase.purchaseId, unknownDatePurchase.purchaseId, datedZeroPurchase.purchaseId] } },
      orderBy: { purchaseId: "asc" },
    });
    expect(appliedEvents).toHaveLength(3);
    expect(appliedEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          purchaseId: knownDatePurchase.purchaseId,
          amount: new Prisma.Decimal(45_000),
          source: PackageRefundEventSource.LEGACY_AGGREGATE,
          occurredAt: null,
        }),
        expect.objectContaining({
          purchaseId: unknownDatePurchase.purchaseId,
          amount: new Prisma.Decimal(7_000),
          source: PackageRefundEventSource.LEGACY_AGGREGATE,
          occurredAt: null,
        }),
        expect.objectContaining({
          purchaseId: datedZeroPurchase.purchaseId,
          amount: new Prisma.Decimal(0),
          source: PackageRefundEventSource.LEGACY_AGGREGATE,
          occurredAt: knownDate,
        }),
      ]),
    );

    const rerun = await runBackfill(
      scopedBackfill([knownDatePurchase.purchaseId, unknownDatePurchase.purchaseId, datedZeroPurchase.purchaseId]),
      { dryRun: false },
    );
    expect(rerun).toMatchObject({ aggregateCount: 0, importedRequestCount: 0, findings: [] });
    expect(await prisma.packageRefundEvent.count({ where: { purchaseId: { in: [knownDatePurchase.purchaseId, unknownDatePurchase.purchaseId, datedZeroPurchase.purchaseId] } } })).toBe(3);

    const eventsReport = await buildRefundedPackagesReport(prisma, {
      from: new Date("2026-08-01T00:00:00.000Z"),
      to: new Date("2026-08-31T23:59:59.999Z"),
    });
    expect(eventsReport.historyMode).toBe("EVENTS");
    if (eventsReport.historyMode !== "EVENTS") throw new Error("expected events report");
    const ownDated = eventsReport.items.filter((item) => item.purchaseId === datedZeroPurchase.purchaseId);
    const ownPositivePurchaseIds = new Set<string>([
      knownDatePurchase.purchaseId,
      unknownDatePurchase.purchaseId,
    ]);
    const ownUndated = eventsReport.undatedHistorical.items.filter((item) =>
      ownPositivePurchaseIds.has(item.purchaseId),
    );
    expect(ownDated).toHaveLength(1);
    expect(ownDated[0]).toMatchObject({
      amountPaid: 0,
      refundAmount: 0,
      source: PackageRefundEventSource.LEGACY_AGGREGATE,
      occurredAt: knownDate.toISOString(),
    });
    expect(ownUndated).toHaveLength(2);
    expect(ownUndated).toEqual(expect.arrayContaining([
      expect.objectContaining({
        purchaseId: knownDatePurchase.purchaseId,
        amountPaid: 45_000,
        refundAmount: 45_000,
        source: PackageRefundEventSource.LEGACY_AGGREGATE,
        occurredAt: null,
      }),
      expect.objectContaining({
        purchaseId: unknownDatePurchase.purchaseId,
        amountPaid: 7_000,
        refundAmount: 7_000,
        source: PackageRefundEventSource.LEGACY_AGGREGATE,
        occurredAt: null,
      }),
    ]));
  });

  it("reports an over-cumulative legacy request/event mismatch without writing a per-purchase event", async () => {
    const seeded = await seedPurchase({ amountPaid: 1_000 });
    await prisma.packagePurchase.update({
      where: { id: seeded.purchaseId },
      data: { refundAmount: new Prisma.Decimal(1_000) },
    });
    await prisma.packageRefundEvent.create({
      data: {
        purchaseId: seeded.purchaseId,
        amount: new Prisma.Decimal(400),
        cumulativeRefundAmount: null,
        source: PackageRefundEventSource.LIVE,
        refundType: PackageRefundType.PARTIAL,
        occurredAt: new Date("2026-08-21T00:00:00.000Z"),
        notes: "synthetic mismatch",
        processedBy: "real-e2e",
        sourceRefundRequestId: null,
        legacyAggregateKey: null,
      },
    });
    await prisma.refundRequest.create({
      data: {
        id: randomUUID(),
        invoiceId: seeded.invoiceId!,
        paymentId: seeded.paymentId!,
        clientId: randomUUID(),
        amount: new Prisma.Decimal(800),
        reason: "synthetic over-cumulative request",
        status: RefundStatus.COMPLETED,
        processedAt: new Date("2026-08-22T00:00:00.000Z"),
        processedBy: "real-e2e",
      },
    });

    const beforeCount = await prisma.packageRefundEvent.count({ where: { purchaseId: seeded.purchaseId } });
    const result = await runBackfill(scopedBackfill([seeded.purchaseId]), { dryRun: false });
    expect(result).toMatchObject({
      purchasesConsidered: 1,
      aggregateCount: 0,
      importedRequestCount: 0,
      findings: [{ purchaseId: seeded.purchaseId, reason: "over-cumulative" }],
    });
    expect(await prisma.packageRefundEvent.count({ where: { purchaseId: seeded.purchaseId } })).toBe(beforeCount);
  });
});
