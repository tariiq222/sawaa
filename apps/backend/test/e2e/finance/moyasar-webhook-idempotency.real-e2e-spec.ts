import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../../src/app.module';
import { PrismaService } from '../../../src/infrastructure/database';
import { MoyasarApiClient } from '../../../src/modules/finance/moyasar-api/moyasar-api.client';
import { MoyasarCredentialsService } from '../../../src/infrastructure/payments/moyasar-credentials.service';

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

  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const invoiceId = `00000000-0000-4000-8000-${suffix.replace(/[^0-9a-f]/gi, '0').slice(0, 12).padEnd(12, '0')}`;
  const gatewayPaymentId = `pay_realE2e_${suffix}`;
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
        getPaymentStatus: jest.fn().mockResolvedValue({
          id: gatewayPaymentId,
          status: 'paid',
          amount: TOTAL_HALALAS,
          currency: 'SAR',
        }),
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

    await prisma.organizationPaymentConfig.create({
      data: {
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
    await prisma.webhookEvent.deleteMany({ where: { eventId } }).catch(() => undefined);
    await prisma.payment.deleteMany({ where: { invoiceId } }).catch(() => undefined);
    await prisma.invoice.deleteMany({ where: { id: invoiceId } }).catch(() => undefined);
    await prisma.organizationPaymentConfig.deleteMany({ where: { publishableKey: 'pk_test_realE2e' } }).catch(() => undefined);
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

  it('processes the first delivery and dedups the second (DB-level idempotency)', async () => {
    const payload = buildWebhook();

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

    const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    expect(invoice?.status).toBe('PAID');
  });
});
