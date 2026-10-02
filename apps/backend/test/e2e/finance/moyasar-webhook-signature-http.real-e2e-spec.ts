/**
 * Moyasar webhook signature over real HTTP — real Postgres regression.
 *
 * The idempotency suite authenticates with the body `secret_token`, so it does
 * not depend on raw-body wiring. This suite covers the HMAC channel end to
 * end: the app is bootstrapped like main.ts (rawBody, helmet, CSRF bypass,
 * production HTTP contract) and the `X-Moyasar-Signature` header is computed
 * over the exact bytes sent. If the raw body were lost or re-serialized, the
 * valid-signature case would stop marking the invoice paid.
 *
 * Every rejected case must 200-ack (no Moyasar retry storm) and leave no
 * Payment, WebhookEvent or invoice change behind.
 */
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type * as express from 'express';
import { createHmac } from 'node:crypto';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../../../src/app.module';
import { PrismaService } from '../../../src/infrastructure/database';
import { MoyasarApiClient } from '../../../src/modules/finance/moyasar-api/moyasar-api.client';
import { MoyasarCredentialsService } from '../../../src/infrastructure/payments/moyasar-credentials.service';
import { configureHttpContract } from '../../../src/common/bootstrap/configure-http-contract';
import { csrfMiddleware } from '../../../src/common/middleware/csrf.middleware';
import { shouldBypassCsrf } from '../../../src/common/middleware/csrf-policy';

const describeRealE2e = process.env.REAL_E2E_DATABASE_URL ? describe : describe.skip;

const WEBHOOK_SECRET = 'real-e2e-hmac-webhook-secret';
const TOTAL_HALALAS = 23000;
const ROUTE = '/api/v1/public/payments/webhook';

describeRealE2e('Moyasar webhook HMAC signature over HTTP — real-DB e2e', () => {
  jest.setTimeout(60_000);

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
  const hex = suffix.replace(/[^0-9a-f]/gi, '6').slice(0, 12).padEnd(12, '6');
  const invoiceId = `60000000-0000-4000-8000-${hex}`;
  const gatewayPaymentId = `pay_hmac_${suffix}`;

  /** Deliberately unusual formatting and key order: only the raw bytes are signed. */
  function rawPayload(overrides: { amount?: number; secretToken?: string } = {}): string {
    const secret = overrides.secretToken === undefined ? '' : `,  "secret_token": ${JSON.stringify(overrides.secretToken)}`;
    return `{ "type":"payment_paid" ,"id": "evt_hmac_${suffix}"${secret},
      "data": {"status":"paid", "amount": ${overrides.amount ?? TOTAL_HALALAS}, "currency":"SAR",
        "metadata": {"invoiceId":"${invoiceId}"}, "id":"${gatewayPaymentId}"} }`;
  }

  function sign(body: string, secret = WEBHOOK_SECRET): string {
    return createHmac('sha256', secret).update(body).digest('hex');
  }

  function post(body: string, signature?: string) {
    const req = request(app.getHttpServer()).post(ROUTE).set('Content-Type', 'application/json');
    if (signature !== undefined) req.set('X-Moyasar-Signature', signature);
    return req.send(body);
  }

  async function expectUntouched() {
    expect(await prisma.payment.count({ where: { invoiceId } })).toBe(0);
    expect(await prisma.webhookEvent.count({ where: { eventId: { startsWith: gatewayPaymentId } } })).toBe(0);
    const invoice = await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
    expect(invoice.status).toBe('ISSUED');
  }

  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.REAL_E2E_DATABASE_URL!;

    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] })
      // The re-fetch is authoritative; report a paid payment matching the invoice.
      .overrideProvider(MoyasarApiClient)
      .useValue({
        getPaymentStatus: jest.fn().mockImplementation((_org: string, paymentId: string) =>
          Promise.resolve({ id: paymentId, status: 'paid', amount: TOTAL_HALALAS, currency: 'SAR' })),
      })
      .overrideProvider(MoyasarCredentialsService)
      .useValue({
        decrypt: jest.fn().mockReturnValue({ webhookSecret: WEBHOOK_SECRET }),
        encrypt: jest.fn().mockReturnValue('enc'),
      })
      .compile();

    // Same request pipeline as main.ts for a webhook request.
    const nest = moduleFixture.createNestApplication<NestExpressApplication>({ rawBody: true });
    nest.use(helmet());
    nest.use(cookieParser());
    nest.use((req: express.Request, res: express.Response, next: express.NextFunction) =>
      shouldBypassCsrf(req.path) ? next() : csrfMiddleware(req, res, next));
    configureHttpContract(nest, 'production');
    app = nest;
    await app.init();

    prisma = app.get(PrismaService);
    previousPaymentConfig = await prisma.organizationPaymentConfig.findUnique({
      where: { singletonKey: 'singleton' },
      select: {
        id: true, publishableKey: true, secretKeyEnc: true, webhookSecretEnc: true,
        isLive: true, lastVerifiedAt: true, lastVerifiedStatus: true,
      },
    });
    await prisma.organizationPaymentConfig.upsert({
      where: { singletonKey: 'singleton' },
      update: { publishableKey: 'pk_test_hmacE2e', secretKeyEnc: 'enc', webhookSecretEnc: 'enc', isLive: false },
      create: { publishableKey: 'pk_test_hmacE2e', secretKeyEnc: 'enc', webhookSecretEnc: 'enc', isLive: false },
    });
    await prisma.invoice.create({
      data: {
        id: invoiceId,
        branchId: 'real-e2e-branch',
        clientId: 'real-e2e-client',
        employeeId: 'real-e2e-employee',
        bookingId: `real-e2e-hmac-booking-${suffix}`,
        subtotal: TOTAL_HALALAS,
        vatAmt: 0,
        total: TOTAL_HALALAS,
        currency: 'SAR',
        status: 'ISSUED',
      },
    });
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.outboxEvent.deleteMany({ where: { aggregateId: invoiceId } }).catch(() => undefined);
      await prisma.webhookEvent.deleteMany({ where: { eventId: { startsWith: gatewayPaymentId } } }).catch(() => undefined);
      await prisma.payment.deleteMany({ where: { invoiceId } }).catch(() => undefined);
      await prisma.invoice.deleteMany({ where: { id: invoiceId } }).catch(() => undefined);
      if (previousPaymentConfig) {
        const { id, ...data } = previousPaymentConfig;
        await prisma.organizationPaymentConfig.update({ where: { id }, data }).catch(() => undefined);
      } else {
        await prisma.organizationPaymentConfig.deleteMany({ where: { singletonKey: 'singleton' } }).catch(() => undefined);
      }
    }
    if (app) await app.close();
  });

  // Rejections run first: each must leave the invoice exactly as seeded.
  it('acks and ignores a body altered after signing', async () => {
    const signed = rawPayload();
    const res = await post(rawPayload({ amount: 1 }), sign(signed));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ skipped: true, reason: 'invalid_signature' });
    await expectUntouched();
  });

  it('acks and ignores a signature made with another secret', async () => {
    const body = rawPayload();
    const res = await post(body, sign(body, 'not-the-webhook-secret'));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ skipped: true, reason: 'invalid_signature' });
    await expectUntouched();
  });

  it('acks and ignores a malformed (non-hex) signature without a 5xx', async () => {
    const res = await post(rawPayload(), 'zz-not-hex');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ skipped: true, reason: 'invalid_signature' });
    await expectUntouched();
  });

  it('does not fall back to a valid body secret_token when the header is wrong', async () => {
    const body = rawPayload({ secretToken: WEBHOOK_SECRET });
    const res = await post(body, sign(body, 'not-the-webhook-secret'));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ skipped: true, reason: 'invalid_signature' });
    await expectUntouched();
  });

  it('acks and ignores a webhook with neither a signature header nor a secret_token', async () => {
    const res = await post(rawPayload());
    expect(res.status).toBe(200);
    expect(res.body.skipped).toBe(true);
    await expectUntouched();
  });

  it('processes a webhook whose HMAC header matches the exact raw bytes', async () => {
    const body = rawPayload();
    const res = await post(body, sign(body));
    expect(res.status).toBe(200);
    expect(res.body.skipped).not.toBe(true);

    const payments = await prisma.payment.findMany({ where: { invoiceId } });
    expect(payments).toHaveLength(1);
    expect(payments[0].status).toBe('COMPLETED');
    const invoice = await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
    expect(invoice.status).toBe('PAID');
  });
});
