import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../../src/app.module';
import { PrismaService, RlsTransactionService } from '../../../src/infrastructure/database';
import { MoyasarApiClient } from '../../../src/modules/finance/moyasar-api/moyasar-api.client';
import { MoyasarCredentialsService } from '../../../src/infrastructure/payments/moyasar-credentials.service';
import { stableEventId } from '../../../src/common/events';
import { ReconcilePaymentsCron } from '../../../src/modules/ops/cron-tasks/reconcile-payments.cron';

/**
 * R-26 (focused): the Moyasar booking-payment webhook must be idempotent at the
 * DATABASE level. A second delivery of the same signed event (same payment id +
 * status) must NOT create a second WebhookEvent row or re-process the payment —
 * this relies on the real `WebhookEvent @@unique([provider, eventId])` constraint
 * raising P2002, which a mocked Prisma cannot prove. The webhook's signature
 * verification, anti-spoof amount check, and CONFIRMED transition are covered by
 * unit specs; this spec exclusively pins the real-DB idempotency contract.
 *
 * Skipped automatically when REAL_E2E_DATABASE_URL is not set (e.g. PR CI).
 */
const describeRealE2e = process.env.REAL_E2E_DATABASE_URL ? describe : describe.skip;

const WEBHOOK_SECRET = 'real-e2e-webhook-secret';
const TOTAL_HALALAS = 23000; // invoice.total + Moyasar fetched amount must match

describeRealE2e('Moyasar webhook idempotency (real e2e, R-26)', () => {
  jest.setTimeout(30_000);

  let app: INestApplication;
  let prisma: PrismaService;
  let previousPaymentConfig: {
    id: string;
    publishableKey: string;
    secretKeyEnc: string;
    webhookSecretEnc: string;
    isLive: boolean;
    lastVerifiedAt: Date | null;
    lastVerifiedStatus: string | null;
  } | null = null;

  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const invoiceId = `00000000-0000-4000-8000-${suffix.replace(/[^0-9a-f]/gi, '0').slice(0, 12).padEnd(12, '0')}`;
  const gatewayPaymentId = `pay_realE2e_${suffix}`;
  const concurrentInvoiceId = `10000000-0000-4000-8000-${suffix.replace(/[^0-9a-f]/gi, '1').slice(0, 12).padEnd(12, '1')}`;
  const concurrentGatewayPaymentId = `pay_concurrent_${suffix}`;
  let concurrentPaymentId = '';
  // The handler keys WebhookEvent.eventId on `${paymentId}:${normalizedStatus}`,
  // where normalizedStatus is the raw Moyasar status string ('paid'), not the
  // internal PaymentStatus enum.
  const eventId = `${gatewayPaymentId}:paid`;

  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.REAL_E2E_DATABASE_URL!;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      // Re-fetch is authoritative — return a paid payment whose amount matches
      // the seeded invoice so the anti-spoof check passes.
      .overrideProvider(MoyasarApiClient)
      .useValue({
        getPaymentStatus: jest.fn().mockImplementation((_org: string, paymentId: string) =>
          Promise.resolve({
            id: paymentId,
            status: 'paid',
            amount: TOTAL_HALALAS,
            currency: 'SAR',
          })),
      })
      // Decrypt the per-tenant webhook secret to our known signing secret.
      .overrideProvider(MoyasarCredentialsService)
      .useValue({
        decrypt: jest.fn().mockReturnValue({ webhookSecret: WEBHOOK_SECRET }),
        encrypt: jest.fn().mockReturnValue('enc'),
      })
      // EventBusService is left real; setup-e2e.ts already mocks the underlying
      // Redis/BullMQ transport, so publish() is a no-op without breaking the
      // subscribe() wiring other modules perform on init.
      .compile();

    app = moduleFixture.createNestApplication({ rawBody: true });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, transformOptions: { enableImplicitConversion: true } }),
    );
    app.setGlobalPrefix('api/v1');
    await app.init();

    prisma = app.get(PrismaService);
    await prisma.$queryRaw`SELECT 1`;

    previousPaymentConfig = await prisma.organizationPaymentConfig.findUnique({
      where: { singletonKey: 'singleton' },
      select: {
        id: true,
        publishableKey: true,
        secretKeyEnc: true,
        webhookSecretEnc: true,
        isLive: true,
        lastVerifiedAt: true,
        lastVerifiedStatus: true,
      },
    });
    await cleanup();

    await prisma.invoice.create({
      data: {
        id: invoiceId,
        branchId: 'real-e2e-branch',
        clientId: 'real-e2e-client',
        employeeId: 'real-e2e-employee',
        bookingId: `real-e2e-booking-${suffix}`,
        subtotal: 20000,
        vatAmt: 3000,
        total: TOTAL_HALALAS,
        currency: 'SAR',
        status: 'ISSUED',
      },
    });
    await prisma.invoice.create({
      data: {
        id: concurrentInvoiceId,
        branchId: 'real-e2e-branch',
        clientId: 'real-e2e-client',
        employeeId: 'real-e2e-employee',
        bookingId: null,
        packagePurchaseId: `real-e2e-package-${suffix}`,
        subtotal: TOTAL_HALALAS,
        vatAmt: 0,
        total: TOTAL_HALALAS,
        currency: 'SAR',
        status: 'ISSUED',
      },
    });
    const concurrentPayment = await prisma.payment.create({
      data: {
        invoiceId: concurrentInvoiceId,
        amount: TOTAL_HALALAS,
        currency: 'SAR',
        method: 'ONLINE_CARD',
        status: 'PENDING',
        gatewayRef: concurrentGatewayPaymentId,
        idempotencyKey: `client:${concurrentInvoiceId}`,
      },
    });
    concurrentPaymentId = concurrentPayment.id;

    await prisma.organizationPaymentConfig.upsert({
      where: { singletonKey: 'singleton' },
      update: {
        publishableKey: 'pk_test_realE2e',
        secretKeyEnc: 'enc',
        webhookSecretEnc: 'enc',
        isLive: false,
      },
      create: {
        publishableKey: 'pk_test_realE2e',
        secretKeyEnc: 'enc',
        webhookSecretEnc: 'enc',
        isLive: false,
      },
    });
  });

  afterAll(async () => {
    if (prisma) await cleanup();
    if (app) await app.close();
  });

  async function cleanup() {
    await prisma.outboxEvent.deleteMany({
      where: { aggregateId: { in: [invoiceId, concurrentInvoiceId] } },
    }).catch(() => undefined);
    await prisma.webhookEvent.deleteMany({
      where: {
        OR: [
          { eventId: { startsWith: gatewayPaymentId } },
          { eventId: { startsWith: concurrentGatewayPaymentId } },
        ],
      },
    }).catch(() => undefined);
    await prisma.payment.deleteMany({
      where: { invoiceId: { in: [invoiceId, concurrentInvoiceId] } },
    }).catch(() => undefined);
    await prisma.invoice.deleteMany({
      where: { id: { in: [invoiceId, concurrentInvoiceId] } },
    }).catch(() => undefined);
    if (previousPaymentConfig) {
      await prisma.organizationPaymentConfig
        .update({
          where: { id: previousPaymentConfig.id },
          data: {
            publishableKey: previousPaymentConfig.publishableKey,
            secretKeyEnc: previousPaymentConfig.secretKeyEnc,
            webhookSecretEnc: previousPaymentConfig.webhookSecretEnc,
            isLive: previousPaymentConfig.isLive,
            lastVerifiedAt: previousPaymentConfig.lastVerifiedAt,
            lastVerifiedStatus: previousPaymentConfig.lastVerifiedStatus,
          },
        })
        .catch(() => undefined);
    } else {
      await prisma.organizationPaymentConfig
        .deleteMany({ where: { singletonKey: 'singleton' } })
        .catch(() => undefined);
    }
  }

  function buildWebhook() {
    // Authenticate via the body `secret_token` channel (a Moyasar-supported
    // alternative to the X-Moyasar-Signature HMAC header). This keeps the e2e
    // independent of express raw-body wiring while still exercising real
    // secret verification + the DB idempotency constraint.
    return {
      id: `evt_${suffix}`,
      type: 'payment_paid',
      secret_token: WEBHOOK_SECRET,
      data: {
        id: gatewayPaymentId,
        status: 'paid',
        amount: TOTAL_HALALAS,
        currency: 'SAR',
        metadata: { invoiceId },
      },
    };
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
    throw new Error('reconcile transaction never reached the invoice lock wait');
  }

  it('reclaims a crashed claim, processes once, and dedups only after processedAt is set', async () => {
    const payload = buildWebhook();
    await prisma.webhookEvent.create({
      data: {
        provider: 'MOYASAR_TENANT',
        eventId,
        eventType: 'paid',
        payloadHash: 'abandoned-real-e2e',
        processedAt: null,
        result: null,
        receivedAt: new Date(Date.now() - 10 * 60_000),
      },
    });

    const first = await request(app.getHttpServer())
      .post('/api/v1/public/payments/webhook')
      .send(payload);
    expect(first.status).toBe(200);
    expect(first.body.skipped).not.toBe(true);

    const second = await request(app.getHttpServer())
      .post('/api/v1/public/payments/webhook')
      .send(payload);
    expect(second.status).toBe(200);
    expect(second.body).toMatchObject({ skipped: true, reason: 'duplicate' });

    // Exactly one WebhookEvent row, one Payment row, marked COMPLETED, invoice PAID.
    const webhookEvents = await prisma.webhookEvent.count({ where: { eventId } });
    expect(webhookEvents).toBe(1);

    const payments = await prisma.payment.findMany({ where: { invoiceId } });
    expect(payments).toHaveLength(1);
    expect(payments[0].status).toBe('COMPLETED');

    const durableEventId = stableEventId(
      `finance:payment:${payments[0].id}:finance.payment.completed`,
    );
    const outbox = await prisma.outboxEvent.findUnique({ where: { id: durableEventId } });
    expect(outbox).toMatchObject({
      aggregateId: invoiceId,
      eventType: 'finance.payment.completed',
      status: 'PENDING_V2',
      deliveryLane: 'PENDING_V2',
    });

    const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    expect(invoice?.status).toBe('PAID');
  });

  it('returns 503 rather than acknowledging a live unprocessed claim as duplicate', async () => {
    const liveEventId = `${gatewayPaymentId}:captured`;
    await prisma.webhookEvent.create({
      data: {
        provider: 'MOYASAR_TENANT',
        eventId: liveEventId,
        eventType: 'captured',
        payloadHash: 'live-real-e2e',
        processedAt: null,
        result: 'processing:other-owner',
        receivedAt: new Date(),
      },
    });
    const payload = buildWebhook();
    payload.data.status = 'captured';

    const response = await request(app.getHttpServer())
      .post('/api/v1/public/payments/webhook')
      .send(payload);

    expect(response.status).toBe(503);
    const live = await prisma.webhookEvent.findUnique({
      where: { provider_eventId: { provider: 'MOYASAR_TENANT', eventId: liveEventId } },
    });
    expect(live).toMatchObject({ processedAt: null, result: 'processing:other-owner' });
  });

  it('serializes a webhook and reconcile completion into one payment transition and one outbox row', async () => {
    const payload = {
      ...buildWebhook(),
      id: `evt_concurrent_${suffix}`,
      data: {
        ...buildWebhook().data,
        id: concurrentGatewayPaymentId,
        metadata: { invoiceId: concurrentInvoiceId },
      },
    };
    const cron = app.get(ReconcilePaymentsCron) as unknown as {
      finalizeCompleted(args: {
        paymentRowId: string;
        invoice: {
          id: string;
          total: number;
          currency: string;
          bookingId: null;
          packagePurchaseId: null;
          clientId: string;
        };
        amountHalalas: number;
        gatewayPaymentId: string;
      }): Promise<void>;
    };

    const rls = app.get(RlsTransactionService) as unknown as {
      withTransaction: (fn: (tx: unknown) => Promise<unknown>) => Promise<unknown>;
    };
    const originalWithTransaction = rls.withTransaction.bind(rls);
    let lockEntered!: () => void;
    let releaseLock!: () => void;
    const entered = new Promise<void>((resolve) => { lockEntered = resolve; });
    const release = new Promise<void>((resolve) => { releaseLock = resolve; });
    let released = false;
    const transactionSpy = jest.spyOn(rls, 'withTransaction').mockImplementationOnce(
      (fn) => originalWithTransaction(async (tx) => {
        const wrapped = new Proxy(tx as Record<PropertyKey, unknown>, {
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
    );

    const webhookPromise = request(app.getHttpServer())
        .post('/api/v1/public/payments/webhook')
        .send(payload)
        .then((response) => response);
    try {
      await entered;
      const cronPromise = cron.finalizeCompleted({
        paymentRowId: concurrentPaymentId,
        invoice: {
          id: concurrentInvoiceId,
          total: TOTAL_HALALAS,
          currency: 'SAR',
          bookingId: null,
          packagePurchaseId: null,
          clientId: 'real-e2e-client',
        },
        amountHalalas: TOTAL_HALALAS,
        gatewayPaymentId: concurrentGatewayPaymentId,
      });
      await waitForInvoiceLockWait();
      released = true;
      releaseLock();
      const [webhookResponse] = await Promise.all([webhookPromise, cronPromise]);

      expect(webhookResponse.status).toBe(200);
      expect(await prisma.payment.findUnique({ where: { id: concurrentPaymentId } }))
        .toMatchObject({ status: 'COMPLETED' });
      expect(await prisma.invoice.findUnique({ where: { id: concurrentInvoiceId } }))
        .toMatchObject({ status: 'PAID' });
      const durableEventId = stableEventId(
        `finance:payment:${concurrentPaymentId}:finance.payment.completed`,
      );
      expect(await prisma.outboxEvent.count({
        where: { aggregateId: concurrentInvoiceId, eventType: 'finance.payment.completed' },
      })).toBe(1);
      expect(await prisma.outboxEvent.findUnique({ where: { id: durableEventId } })).not.toBeNull();
    } finally {
      if (!released) releaseLock();
      transactionSpy.mockRestore();
    }
  });
});
