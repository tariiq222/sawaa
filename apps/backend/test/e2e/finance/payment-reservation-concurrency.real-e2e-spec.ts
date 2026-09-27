import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { InvoiceStatus, PaymentMethod, PaymentStatus } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { AppModule } from '../../../src/app.module';
import { PrismaService, RlsTransactionService } from '../../../src/infrastructure/database';
import { InitClientPaymentHandler } from '../../../src/modules/finance/payments/client/init-client-payment/init-client-payment.handler';
import { ProcessPaymentHandler } from '../../../src/modules/finance/process-payment/process-payment.handler';
import { BankTransferUploadHandler } from '../../../src/modules/finance/bank-transfer-upload/bank-transfer-upload.handler';
import { stableEventId } from '../../../src/common/events';
import {
  InitPackagePurchaseHandler,
  selfPurchaseFingerprint,
} from '../../../src/modules/finance/package-purchases/init-package-purchase/init-package-purchase.handler';

const describeRealE2e = process.env.REAL_E2E_DATABASE_URL ? describe : describe.skip;

describeRealE2e('Payment reservation concurrency — real Postgres', () => {
  jest.setTimeout(60_000);

  let app: INestApplication;
  let prisma: PrismaService;
  let rls: RlsTransactionService;
  const invoiceIds: string[] = [];
  const clientId = `payment-race-client-${randomUUID()}`;

  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.REAL_E2E_DATABASE_URL!;
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    rls = app.get(RlsTransactionService);
    await prisma.$queryRaw`SELECT 1`;
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.outboxEvent.deleteMany({ where: { aggregateId: { in: invoiceIds } } });
      await prisma.payment.deleteMany({ where: { invoiceId: { in: invoiceIds } } });
      await prisma.invoice.deleteMany({ where: { id: { in: invoiceIds } } });
    }
    if (app) await app.close();
  });

  async function createInvoice(total = 230) {
    const id = randomUUID();
    invoiceIds.push(id);
    return prisma.invoice.create({
      data: {
        id,
        branchId: `payment-race-branch-${id}`,
        clientId,
        employeeId: `payment-race-employee-${id}`,
        bookingId: null,
        packagePurchaseId: `payment-race-package-${id}`,
        subtotal: total,
        vatAmt: 0,
        total,
        currency: 'SAR',
        status: InvoiceStatus.ISSUED,
      },
    });
  }

  function initPrisma() {
    return new Proxy(prisma as unknown as Record<PropertyKey, unknown>, {
      get(target, property, receiver) {
        if (property === 'organizationSettings') {
          return { findFirst: jest.fn().mockResolvedValue({ paymentMoyasarEnabled: true }) };
        }
        const value = Reflect.get(target, property, receiver);
        return typeof value === 'function' ? value.bind(prisma) : value;
      },
    });
  }

  function checkout(id: string, amount: number) {
    return {
      id: `checkout-${id}`,
      status: 'initiated',
      amount,
      currency: 'SAR',
      url: `https://checkout.test/${id}`,
      metadata: { internalPaymentId: id },
      payments: [],
    };
  }

  function buildInit(moyasar: Record<string, jest.Mock>) {
    return new InitClientPaymentHandler(
      initPrisma() as never,
      moyasar as never,
      rls,
    );
  }

  function buildProcess(transactionService: unknown = rls, eventBus?: unknown) {
    const resolvedEventBus = eventBus ?? { publish: jest.fn() };
    return new ProcessPaymentHandler(prisma, transactionService as never, resolvedEventBus as never);
  }

  async function waitForInvoiceLockWait(): Promise<void> {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const rows = await prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*)::bigint AS count
        FROM pg_stat_activity
        WHERE datname = current_database()
          AND wait_event_type = 'Lock'
          AND query LIKE '%FROM "Invoice"%FOR UPDATE%'
      `;
      if (Number(rows[0]?.count ?? 0) > 0) return;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error('card transaction never reached the invoice lock wait');
  }

  it('re-reads cash committed ahead of the card lock and reserves only the remainder', async () => {
    const invoice = await createInvoice(230);
    let lockEntered!: () => void;
    let releaseLock!: () => void;
    const entered = new Promise<void>((resolve) => { lockEntered = resolve; });
    const release = new Promise<void>((resolve) => { releaseLock = resolve; });
    const heldRls = {
      withTransaction: (fn: (tx: unknown) => Promise<unknown>) =>
        prisma.$transaction(async (tx) => {
          const wrapped = new Proxy(tx as unknown as Record<PropertyKey, unknown>, {
            get(target, property, receiver) {
              if (property === '$queryRaw') {
                return async (...args: unknown[]) => {
                  const query = Reflect.get(target, property) as (
                    ...inner: unknown[]
                  ) => Promise<unknown>;
                  const result = await query.apply(tx, args);
                  lockEntered();
                  await release;
                  return result;
                };
              }
              const value = Reflect.get(target, property, receiver);
              return typeof value === 'function' ? value.bind(tx) : value;
            },
          });
          return fn(wrapped);
        }),
    };
    const cashPromise = buildProcess(heldRls).execute({
      invoiceId: invoice.id,
      amount: 100,
      method: PaymentMethod.CASH,
      idempotencyKey: `cash-before-card-${invoice.id}`,
    });
    await entered;

    const moyasar = {
      createCheckoutInvoice: jest.fn(async (_org: string, input: { metadata: { internalPaymentId: string }; amountHalalas: number }) =>
        checkout(input.metadata.internalPaymentId, input.amountHalalas)),
      findCheckoutInvoiceByMetadata: jest.fn(),
      getCheckoutInvoice: jest.fn(),
      getPaymentStatus: jest.fn(),
    };
    const cardPromise = buildInit(moyasar).execute({ invoiceId: invoice.id, clientId });
    await waitForInvoiceLockWait();
    releaseLock();
    await cashPromise;
    await cardPromise;

    expect(moyasar.createCheckoutInvoice).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ amountHalalas: 130 }),
    );
    const rows = await prisma.payment.findMany({ where: { invoiceId: invoice.id } });
    expect(rows.map((row) => [row.status, Number(row.amount)])).toEqual(
      expect.arrayContaining([
        [PaymentStatus.COMPLETED, 100],
        [PaymentStatus.PENDING, 130],
      ]),
    );
  });

  it('blocks cash after a card reservation commits but before provider response returns', async () => {
    const invoice = await createInvoice(230);
    let providerEntered!: () => void;
    let releaseProvider!: () => void;
    const entered = new Promise<void>((resolve) => { providerEntered = resolve; });
    const release = new Promise<void>((resolve) => { releaseProvider = resolve; });
    const moyasar = {
      createCheckoutInvoice: jest.fn(async (_org: string, input: { metadata: { internalPaymentId: string }; amountHalalas: number }) => {
        providerEntered();
        await release;
        return checkout(input.metadata.internalPaymentId, input.amountHalalas);
      }),
      findCheckoutInvoiceByMetadata: jest.fn(),
      getCheckoutInvoice: jest.fn(),
      getPaymentStatus: jest.fn(),
    };
    const cardPromise = buildInit(moyasar).execute({ invoiceId: invoice.id, clientId });
    await entered;

    await expect(buildProcess().execute({
      invoiceId: invoice.id,
      amount: 230,
      method: PaymentMethod.CASH,
    })).rejects.toThrow('pending completion or verification');
    releaseProvider();
    await cardPromise;

    expect(await prisma.payment.count({ where: { invoiceId: invoice.id } })).toBe(1);
  });

  it('blocks card initialization when a bank-transfer reservation already exists', async () => {
    const invoice = await createInvoice(230);
    await prisma.payment.create({
      data: {
        invoiceId: invoice.id,
        amount: 230,
        currency: 'SAR',
        method: PaymentMethod.BANK_TRANSFER,
        status: PaymentStatus.PENDING_VERIFICATION,
      },
    });
    const moyasar = {
      createCheckoutInvoice: jest.fn(),
      findCheckoutInvoiceByMetadata: jest.fn(),
      getCheckoutInvoice: jest.fn(),
      getPaymentStatus: jest.fn(),
    };

    await expect(buildInit(moyasar).execute({ invoiceId: invoice.id, clientId }))
      .rejects.toThrow('another payment pending');
    expect(moyasar.createCheckoutInvoice).not.toHaveBeenCalled();
  });

  it('blocks bank-transfer upload when a card reservation already exists', async () => {
    const invoice = await createInvoice(230);
    await prisma.payment.create({
      data: {
        invoiceId: invoice.id,
        amount: 230,
        currency: 'SAR',
        method: PaymentMethod.ONLINE_CARD,
        status: PaymentStatus.PENDING,
        idempotencyKey: `client:${invoice.id}`,
      },
    });
    const storage = {
      uploadFile: jest.fn().mockResolvedValue('receipts/test.png'),
      deleteFile: jest.fn().mockResolvedValue(undefined),
    };
    const handler = new BankTransferUploadHandler(prisma, storage as never, rls);
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nJ8AAAAASUVORK5CYII=',
      'base64',
    );

    await expect(handler.execute({
      invoiceId: invoice.id,
      amount: 230,
      clientId,
      fileBuffer: png,
      mimetype: 'image/png',
      filename: 'receipt.png',
    })).rejects.toThrow('fully paid or reserved');
    expect(storage.deleteFile).toHaveBeenCalled();
    expect(await prisma.payment.count({ where: { invoiceId: invoice.id } })).toBe(1);
  });

  it('serializes generic and package checkout keys against the same invoice', async () => {
    const invoice = await createInvoice(230);
    let providerEntered!: () => void;
    let releaseProvider!: () => void;
    const entered = new Promise<void>((resolve) => { providerEntered = resolve; });
    const release = new Promise<void>((resolve) => { releaseProvider = resolve; });
    const moyasar = {
      createCheckoutInvoice: jest.fn(async (_org: string, input: { metadata: { internalPaymentId: string }; amountHalalas: number }) => {
        providerEntered();
        await release;
        return checkout(input.metadata.internalPaymentId, input.amountHalalas);
      }),
      findCheckoutInvoiceByMetadata: jest.fn(),
      getCheckoutInvoice: jest.fn(),
      getPaymentStatus: jest.fn(),
    };
    const genericCheckout = buildInit(moyasar).execute({ invoiceId: invoice.id, clientId });
    await entered;

    const packageCommand = {
      idempotencyKey: randomUUID(),
      packageId: `package-${invoice.id}`,
      branchId: invoice.branchId,
      clientId,
    };
    const fingerprint = selfPurchaseFingerprint(packageCommand);
    const packagePurchaseId = `purchase-${invoice.id}`;
    const packagePrisma = new Proxy(prisma as unknown as Record<PropertyKey, unknown>, {
      get(target, property, receiver) {
        if (property === 'packagePurchase') {
          return {
            findUnique: jest.fn().mockResolvedValue({
              id: packagePurchaseId,
              requestFingerprint: fingerprint,
              status: 'PENDING',
              subtotalSnapshot: 230,
              discountSnapshot: 0,
              amountPaid: 230,
              creditSnapshot: [{
                serviceId: null,
                employeeId: null,
                durationOptionId: null,
                unitPriceSnapshot: 230,
                totalQuantity: 1,
                constraints: [],
              }],
            }),
            findFirst: jest.fn().mockResolvedValue({
              id: packagePurchaseId,
              idempotencyKey: packageCommand.idempotencyKey,
              requestFingerprint: fingerprint,
            }),
          };
        }
        if (property === 'invoice') {
          const delegate = Reflect.get(target, property, receiver) as Record<PropertyKey, unknown>;
          return new Proxy(delegate, {
            get(invoiceTarget, invoiceProperty, invoiceReceiver) {
              if (invoiceProperty === 'findFirst') {
                return jest.fn().mockResolvedValue({ id: invoice.id });
              }
              const value = Reflect.get(invoiceTarget, invoiceProperty, invoiceReceiver);
              return typeof value === 'function' ? value.bind(delegate) : value;
            },
          });
        }
        const value = Reflect.get(target, property, receiver);
        return typeof value === 'function' ? value.bind(prisma) : value;
      },
    });
    const packageHandler = new InitPackagePurchaseHandler(
      packagePrisma as never,
      rls,
      { compute: jest.fn() } as never,
      moyasar as never,
    );

    try {
      await expect(packageHandler.execute(packageCommand)).rejects.toThrow(
        'Another payment is already pending',
      );
    } finally {
      releaseProvider();
      await genericCheckout;
    }

    expect(await prisma.payment.count({ where: { invoiceId: invoice.id } })).toBe(1);
  });

  it('commits manual payment and stable outbox row without depending on broker availability', async () => {
    const invoice = await createInvoice(230);
    const eventBus = { publish: jest.fn().mockRejectedValue(new Error('broker unavailable')) };
    const payment = await buildProcess(rls, eventBus).execute({
      invoiceId: invoice.id,
      amount: 230,
      method: PaymentMethod.CASH,
      idempotencyKey: `manual-outbox-${invoice.id}`,
    });

    expect(eventBus.publish).not.toHaveBeenCalled();
    const outboxId = stableEventId(
      `finance:payment:${payment.id}:finance.payment.completed`,
    );
    expect(await prisma.outboxEvent.findUnique({ where: { id: outboxId } })).toMatchObject({
      aggregateId: invoice.id,
      eventType: 'finance.payment.completed',
      status: 'PENDING_V2',
      deliveryLane: 'PENDING_V2',
    });
  });
});
