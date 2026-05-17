import { createHmac } from 'crypto';
import { NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PaymentStatus } from '@prisma/client';
import { MoyasarWebhookHandler, MoyasarWebhookRequest } from './moyasar-webhook.handler';
import { MoyasarWebhookDto } from './moyasar-webhook.dto';
import { DEFAULT_ORG_ID, TENANT_CLS_KEY } from '../../../common/constants';

const TEST_SECRET = 'test-secret';
const FAKE_CIPHERTEXT = 'fake-encrypted-webhook-secret-ciphertext';

const ORG_A = 'org-a-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const ORG_B = 'org-b-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

function buildInvoice(organizationId: string, id: string = 'inv-1'): Record<string, unknown> {
  return { id, organizationId, bookingId: `booking-${id}`, clientId: `client-${id}`, currency: 'SAR', total: 230, status: 'ISSUED' };
}

function buildPaymentConfig(organizationId: string): Record<string, unknown> {
  return { id: `cfg-${organizationId}`, organizationId, publishableKey: 'pk_test_xxxx', secretKeyEnc: 'fake-secret-key-enc', webhookSecretEnc: FAKE_CIPHERTEXT, isLive: false };
}

function buildPayment(organizationId: string, id: string = 'pay-1'): Record<string, unknown> {
  return { id, organizationId, invoiceId: 'inv-1', status: PaymentStatus.COMPLETED };
}

interface MockPrisma {
  payment: {
    findFirst: jest.Mock;
    findUnique: jest.Mock;
    upsert: jest.Mock;
  };
  invoice: {
    findFirst: jest.Mock;
    update: jest.Mock;
  };
  organizationPaymentConfig: {
    findFirst: jest.Mock;
  };
  webhookEvent: {
    create: jest.Mock;
    update: jest.Mock;
  };
  $transaction: jest.Mock;
}

function buildPrisma(invoiceOverride?: Record<string, unknown> | null, configOverride?: Record<string, unknown> | null): MockPrisma {
  const paymentFindFirst = jest.fn().mockResolvedValue(null);
  const paymentFindUnique = jest.fn().mockResolvedValue(null);
  const paymentUpsert = jest.fn().mockImplementation(({ create }: { create: Record<string, unknown> }) =>
    Promise.resolve(buildPayment(create.organizationId as string ?? DEFAULT_ORG_ID)),
  );
  const invoiceFindFirst = jest.fn().mockResolvedValue(
    invoiceOverride === null ? null : invoiceOverride ?? buildInvoice(ORG_A),
  );
  const invoiceUpdate = jest.fn().mockResolvedValue({ status: 'PAID' });

  const prisma: MockPrisma = {
    payment: {
      findFirst: paymentFindFirst,
      findUnique: paymentFindUnique,
      upsert: paymentUpsert,
    },
    invoice: {
      findFirst: invoiceFindFirst,
      update: invoiceUpdate,
    },
    organizationPaymentConfig: {
      findFirst: jest.fn().mockResolvedValue(
        configOverride === null ? null : configOverride ?? buildPaymentConfig(ORG_A),
      ),
    },
    webhookEvent: {
      create: jest.fn().mockResolvedValue({ id: 'whe-1' }),
      update: jest.fn().mockResolvedValue({ id: 'whe-1' }),
    },
    $transaction: jest.fn(async <T>(fn: (tx: MockPrisma) => Promise<T>): Promise<T> => {
      return fn(prisma);
    }),
  };

  return prisma;
}

const buildEventBus = () => ({ publish: jest.fn().mockResolvedValue(undefined) });

const buildCreds = (secret: string = TEST_SECRET) => ({
  decrypt: jest.fn().mockReturnValue({ webhookSecret: secret }),
  encrypt: jest.fn().mockReturnValue(FAKE_CIPHERTEXT),
});

function buildCls() {
  const store: Record<string, unknown> = {};
  return {
    run: jest.fn(async (fn: () => Promise<unknown>) => fn()),
    set: jest.fn((key: string, value: unknown) => { store[key] = value; }),
    get: jest.fn((key: string) => store[key]),
  };
}

// invoice.total is 230 halalas; Moyasar amount is also halalas.
const paidPayload: MoyasarWebhookDto = {
  id: 'moyasar-pay-1', status: 'paid', amount: 230, currency: 'SAR',
  metadata: { invoiceId: 'inv-1' },
} as MoyasarWebhookDto;

// Moyasar's documented NESTED webhook shape: event envelope at the root with
// the payment object under `data`. The payment id here is the SAME as the
// flat `paidPayload` so the re-fetch mock resolves identically.
const nestedPaidPayload: MoyasarWebhookDto = {
  id: 'evt_nested_1',
  type: 'payment_paid',
  created_at: '2024-01-15T10:30:00Z',
  data: {
    id: 'moyasar-pay-1', status: 'paid', amount: 230, currency: 'SAR',
    metadata: { invoiceId: 'inv-1' },
  },
} as MoyasarWebhookDto;

const sign = (rawBody: string, secret: string = TEST_SECRET) =>
  createHmac('sha256', secret).update(rawBody).digest('hex');

function makeReq(payload: MoyasarWebhookDto = paidPayload, rawBody?: string): MoyasarWebhookRequest {
  const body = rawBody ?? JSON.stringify(payload);
  return { payload, rawBody: body, signature: sign(body) };
}

interface HandlerOverrides {
  prisma?: ReturnType<typeof buildPrisma>;
  eventBus?: ReturnType<typeof buildEventBus>;
  creds?: ReturnType<typeof buildCreds>;
  cls?: ReturnType<typeof buildCls>;
  /** Authoritative payment as returned by the Moyasar re-fetch. Defaults to a
   *  `paid` payment whose amount matches the 230-halala invoice. */
  fetchedPayment?: { id: string; status: string; amount: number; currency: string };
  /** When set, the moyasarApi.getPaymentStatus mock rejects with this error. */
  fetchError?: unknown;
}

const buildAppMetrics = () => ({
  paymentAttempts: { labels: jest.fn().mockReturnValue({ inc: jest.fn() }) },
});

function makeHandler(overrides: HandlerOverrides = {}) {
  const prisma = overrides.prisma ?? buildPrisma();
  const eventBus = overrides.eventBus ?? buildEventBus();
  const creds = overrides.creds ?? buildCreds();
  const cls = overrides.cls ?? buildCls();
  const appMetrics = buildAppMetrics();
  const rlsTransaction = { withTransaction: jest.fn((fn: any) => fn(prisma)) };

  const getPaymentStatus = overrides.fetchError
    ? jest.fn().mockRejectedValue(overrides.fetchError)
    : jest.fn().mockResolvedValue(
        overrides.fetchedPayment ?? { id: 'moyasar-pay-1', status: 'paid', amount: 230, currency: 'SAR' },
      );
  const moyasarApi = { getPaymentStatus };

  const handler = new MoyasarWebhookHandler(
    prisma as never,
    rlsTransaction as never,
    eventBus as never,
    cls as never,
    creds as never,
    moyasarApi as never,
    appMetrics as never,
  );
  return { handler, prisma, eventBus, creds, cls, appMetrics, moyasarApi };
}

describe('MoyasarWebhookHandler', () => {
  describe('verifySignature', () => {
    it('returns true for a valid signature', () => {
      const { handler } = makeHandler();
      const body = '{"id":"test"}';
      expect(handler.verifySignature(body, sign(body), TEST_SECRET)).toBe(true);
    });

    it('returns false for an invalid signature (does not throw)', () => {
      const { handler } = makeHandler();
      const body = '{"id":"test"}';
      expect(handler.verifySignature(body, sign(body, 'wrong-secret'), TEST_SECRET)).toBe(false);
    });

    it('returns false when signature length differs (not timing-attackable)', () => {
      const { handler } = makeHandler();
      expect(handler.verifySignature('body', 'deadbeef', TEST_SECRET)).toBe(false);
    });
  });

  describe('execute — happy path', () => {
    it('processes paid webhook and emits PaymentCompletedEvent', async () => {
      const { handler, prisma, eventBus } = makeHandler();
      const result = await handler.execute(makeReq());
      expect(prisma.payment.upsert).toHaveBeenCalledWith(expect.objectContaining({
        where: { idempotencyKey: 'moyasar:moyasar-pay-1' },
        create: expect.objectContaining({ amount: 230, status: 'COMPLETED' }),
      }));
      expect(prisma.invoice.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'PAID' }) }));
      expect(eventBus.publish).toHaveBeenCalledWith('finance.payment.completed', expect.anything());
      expect(result.skipped).toBeUndefined();
    });

    it('publishes exactly one PaymentCompletedEvent on a paid webhook', async () => {
      const { handler, eventBus } = makeHandler();
      await handler.execute(makeReq());
      expect(eventBus.publish).toHaveBeenCalledTimes(1);
      expect(eventBus.publish).toHaveBeenCalledWith('finance.payment.completed', expect.anything());
    });

    it('routes the payment by the invoice referenced in metadata', async () => {
      const { handler, prisma, eventBus } = makeHandler({
        prisma: buildPrisma(buildInvoice(ORG_B, 'inv-b'), buildPaymentConfig(ORG_B)),
        creds: buildCreds(TEST_SECRET),
      });
      await handler.execute(makeReq({ ...paidPayload, metadata: { invoiceId: 'inv-b' } }));
      expect(prisma.payment.upsert).toHaveBeenCalledWith(expect.objectContaining({
        create: expect.objectContaining({ invoiceId: 'inv-b' }),
      }));
      expect(eventBus.publish).toHaveBeenCalledWith('finance.payment.completed', expect.anything());
    });

    it('creates a FAILED payment when the re-fetched status is failed', async () => {
      const { handler, prisma } = makeHandler({
        fetchedPayment: { id: 'moyasar-pay-1', status: 'failed', amount: 230, currency: 'SAR' },
      });
      const failedPayload = { ...paidPayload, status: 'failed' as const, message: 'Declined' } as MoyasarWebhookDto;
      await handler.execute(makeReq(failedPayload));
      expect(prisma.payment.upsert).toHaveBeenCalledWith(expect.objectContaining({
        create: expect.objectContaining({ status: 'FAILED', failureReason: 'Declined' }),
      }));
      expect(prisma.invoice.update).not.toHaveBeenCalled();
    });
  });

  describe('execute — payload shape tolerance (nested vs flat)', () => {
    it('processes a NESTED-shape webhook ({ id, type, data: {...} })', async () => {
      const { handler, prisma, eventBus, moyasarApi } = makeHandler();
      const result = await handler.execute(makeReq(nestedPaidPayload));
      // re-fetch keyed on the PAYMENT id (data.id), not the event id
      expect(moyasarApi.getPaymentStatus).toHaveBeenCalledWith(DEFAULT_ORG_ID, 'moyasar-pay-1');
      expect(prisma.payment.upsert).toHaveBeenCalledWith(expect.objectContaining({
        where: { idempotencyKey: 'moyasar:moyasar-pay-1' },
        create: expect.objectContaining({ invoiceId: 'inv-1', amount: 230, status: 'COMPLETED' }),
      }));
      expect(prisma.invoice.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ status: 'PAID' }),
      }));
      expect(eventBus.publish).toHaveBeenCalledWith('finance.payment.completed', expect.anything());
      expect(result.skipped).toBeUndefined();
    });

    it('still processes a FLAT-shape webhook (existing behavior preserved)', async () => {
      const { handler, prisma, eventBus } = makeHandler();
      const result = await handler.execute(makeReq());
      expect(prisma.payment.upsert).toHaveBeenCalledWith(expect.objectContaining({
        create: expect.objectContaining({ amount: 230, status: 'COMPLETED' }),
      }));
      expect(eventBus.publish).toHaveBeenCalledWith('finance.payment.completed', expect.anything());
      expect(result.skipped).toBeUndefined();
    });

    it('keys the WebhookEvent dedup on the PAYMENT id + status, not the root event id', async () => {
      const { handler, prisma } = makeHandler();
      await handler.execute(makeReq(nestedPaidPayload));
      expect(prisma.webhookEvent.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ eventId: 'moyasar-pay-1:paid' }),
      }));
    });

    it('skips (missing_metadata) when a nested shape has no data.metadata', async () => {
      const { handler, prisma } = makeHandler();
      const noMetadata = {
        id: 'evt_nested_2',
        type: 'payment_paid',
        data: { id: 'moyasar-pay-1', status: 'paid', amount: 230, currency: 'SAR' },
      } as MoyasarWebhookDto;
      const result = await handler.execute(makeReq(noMetadata));
      expect(result.skipped).toBe(true);
      expect(result.reason).toBe('missing_metadata');
      expect(prisma.payment.upsert).not.toHaveBeenCalled();
    });
  });

  describe('execute — shared-secret verification (HMAC header vs body secret_token)', () => {
    it('verifies and processes a webhook with NO HMAC header but a valid body secret_token', async () => {
      const { handler, prisma, eventBus } = makeHandler();
      const tokenPayload = { ...nestedPaidPayload, secret_token: TEST_SECRET } as MoyasarWebhookDto;
      const rawBody = JSON.stringify(tokenPayload);
      const result = await handler.execute({ payload: tokenPayload, rawBody, signature: '' });
      expect(result.skipped).toBeUndefined();
      expect(prisma.payment.upsert).toHaveBeenCalledWith(expect.objectContaining({
        create: expect.objectContaining({ status: 'COMPLETED' }),
      }));
      expect(eventBus.publish).toHaveBeenCalledWith('finance.payment.completed', expect.anything());
    });

    it('drops-and-acks (missing_signature) when there is NO HMAC header and NO secret_token', async () => {
      const { handler, prisma, moyasarApi } = makeHandler();
      const rawBody = JSON.stringify(paidPayload);
      const result = await handler.execute({ payload: paidPayload, rawBody, signature: '' });
      expect(result.skipped).toBe(true);
      expect(result.reason).toBe('missing_signature');
      expect(moyasarApi.getPaymentStatus).not.toHaveBeenCalled();
      expect(prisma.payment.upsert).not.toHaveBeenCalled();
      expect(prisma.webhookEvent.create).not.toHaveBeenCalled();
    });

    it('drops-and-acks (invalid_signature) for a wrong body secret_token', async () => {
      const { handler, prisma, moyasarApi } = makeHandler();
      const tokenPayload = { ...paidPayload, secret_token: 'wrong-secret-token' } as MoyasarWebhookDto;
      const rawBody = JSON.stringify(tokenPayload);
      const result = await handler.execute({ payload: tokenPayload, rawBody, signature: '' });
      expect(result.skipped).toBe(true);
      expect(result.reason).toBe('invalid_signature');
      expect(moyasarApi.getPaymentStatus).not.toHaveBeenCalled();
      expect(prisma.payment.upsert).not.toHaveBeenCalled();
    });
  });

  describe('verifySecretToken', () => {
    it('returns true for an exact match', () => {
      const { handler } = makeHandler();
      expect(handler.verifySecretToken(TEST_SECRET, TEST_SECRET)).toBe(true);
    });

    it('returns false for a mismatch (does not throw)', () => {
      const { handler } = makeHandler();
      expect(handler.verifySecretToken('wrong', TEST_SECRET)).toBe(false);
    });

    it('returns false when lengths differ (not timing-attackable)', () => {
      const { handler } = makeHandler();
      expect(handler.verifySecretToken('short', `${TEST_SECRET}-longer`)).toBe(false);
    });
  });

  describe('execute — re-fetch is authoritative', () => {
    it('calls getPaymentStatus with DEFAULT_ORG_ID and the payload id', async () => {
      const { handler, moyasarApi } = makeHandler();
      await handler.execute(makeReq());
      expect(moyasarApi.getPaymentStatus).toHaveBeenCalledWith(DEFAULT_ORG_ID, 'moyasar-pay-1');
    });

    it('uses the FETCHED status/amount, not the request body', async () => {
      // Body claims failed @ 999; the re-fetch says paid @ 230 — fetched wins.
      const lyingBody = { ...paidPayload, status: 'failed' as const, amount: 999 } as MoyasarWebhookDto;
      const { handler, prisma, eventBus } = makeHandler({
        fetchedPayment: { id: 'moyasar-pay-1', status: 'paid', amount: 230, currency: 'SAR' },
      });
      const result = await handler.execute(makeReq(lyingBody));
      expect(result.skipped).toBeUndefined();
      expect(prisma.payment.upsert).toHaveBeenCalledWith(expect.objectContaining({
        create: expect.objectContaining({ amount: 230, status: 'COMPLETED' }),
      }));
      expect(eventBus.publish).toHaveBeenCalledWith('finance.payment.completed', expect.anything());
    });

    it('skips (200 ack) when Moyasar returns 404 on re-fetch — does not mutate', async () => {
      const { handler, prisma } = makeHandler({
        fetchError: new NotFoundException('Payment not found'),
      });
      const result = await handler.execute(makeReq());
      expect(result.skipped).toBe(true);
      expect(result.reason).toBe('payment_not_found');
      expect(prisma.payment.upsert).not.toHaveBeenCalled();
      expect(prisma.invoice.update).not.toHaveBeenCalled();
    });

    it('propagates a transient re-fetch error (5xx so Moyasar retries)', async () => {
      const { handler, prisma } = makeHandler({
        fetchError: new Error('Moyasar API error: Bad Gateway (status: 502)'),
      });
      await expect(handler.execute(makeReq())).rejects.toThrow(/Bad Gateway/);
      expect(prisma.payment.upsert).not.toHaveBeenCalled();
    });

    it('skips (200 ack) for a non-terminal fetched status (authorized) — does not mutate', async () => {
      const { handler, prisma } = makeHandler({
        fetchedPayment: { id: 'moyasar-pay-1', status: 'authorized', amount: 230, currency: 'SAR' },
      });
      const result = await handler.execute(makeReq());
      expect(result.skipped).toBe(true);
      expect(result.reason).toBe('non_terminal_status:authorized');
      expect(prisma.payment.upsert).not.toHaveBeenCalled();
      expect(prisma.invoice.update).not.toHaveBeenCalled();
    });

    it('treats a fetched captured status as COMPLETED', async () => {
      const { handler, prisma } = makeHandler({
        fetchedPayment: { id: 'moyasar-pay-1', status: 'captured', amount: 230, currency: 'SAR' },
      });
      const result = await handler.execute(makeReq());
      expect(result.skipped).toBeUndefined();
      expect(prisma.payment.upsert).toHaveBeenCalledWith(expect.objectContaining({
        create: expect.objectContaining({ status: 'COMPLETED' }),
      }));
    });
  });

  describe('execute — permanent rejections drop-and-ack (no throw, no mutation)', () => {
    it('rejects a forged signature with a skip result — does NOT throw, does NOT mutate', async () => {
      const { handler, prisma, moyasarApi } = makeHandler();
      const rawBody = JSON.stringify(paidPayload);
      const result = await handler.execute({
        payload: paidPayload,
        rawBody,
        signature: sign(rawBody, 'attacker-secret'),
      });
      expect(result.skipped).toBe(true);
      expect(result.reason).toBe('invalid_signature');
      expect(moyasarApi.getPaymentStatus).not.toHaveBeenCalled();
      expect(prisma.payment.upsert).not.toHaveBeenCalled();
      expect(prisma.invoice.update).not.toHaveBeenCalled();
      expect(prisma.webhookEvent.create).not.toHaveBeenCalled();
    });

    it('rejects a signature signed with a different secret (cross-tenant forgery)', async () => {
      const rawBody = JSON.stringify(paidPayload);
      const { handler } = makeHandler();
      const result = await handler.execute({
        payload: paidPayload,
        rawBody,
        signature: sign(rawBody, 'org-b-secret-different'),
      });
      expect(result.skipped).toBe(true);
      expect(result.reason).toBe('invalid_signature');
    });

    it('drops-and-acks when tenant payment config is missing', async () => {
      const { handler } = makeHandler({ prisma: buildPrisma(undefined, null) });
      const result = await handler.execute(makeReq());
      expect(result.skipped).toBe(true);
      expect(result.reason).toBe('missing_payment_config');
    });

    it('drops-and-acks when webhook secret decryption fails', async () => {
      const badCreds = { decrypt: jest.fn().mockImplementation(() => { throw new Error('decryption failed'); }), encrypt: jest.fn() };
      const { handler } = makeHandler({ creds: badCreds });
      const result = await handler.execute(makeReq());
      expect(result.skipped).toBe(true);
      expect(result.reason).toBe('webhook_secret_decrypt_failed');
    });

    it('drops-and-acks when amount does not match invoice.total (anti-spoof)', async () => {
      const { handler, prisma } = makeHandler({
        fetchedPayment: { id: 'moyasar-pay-1', status: 'paid', amount: 1200000, currency: 'SAR' },
      });
      const result = await handler.execute(makeReq());
      expect(result.skipped).toBe(true);
      expect(result.reason).toBe('amount_mismatch');
      expect(prisma.invoice.update).not.toHaveBeenCalled();
      expect(prisma.payment.upsert).not.toHaveBeenCalled();
    });

    it('drops-and-acks when currency does not match invoice.currency', async () => {
      const { handler, prisma } = makeHandler({
        fetchedPayment: { id: 'moyasar-pay-1', status: 'paid', amount: 230, currency: 'KWD' },
      });
      const result = await handler.execute(makeReq());
      expect(result.skipped).toBe(true);
      expect(result.reason).toBe('currency_mismatch');
      expect(prisma.invoice.update).not.toHaveBeenCalled();
    });

    it('skips when metadata is missing', async () => {
      const { handler } = makeHandler();
      const result = await handler.execute(makeReq({ ...paidPayload, metadata: undefined }));
      expect(result.skipped).toBe(true);
      expect(result.reason).toBe('missing_metadata');
    });

    it('skips when the invoice is not found (unknown to this deployment)', async () => {
      const { handler, prisma } = makeHandler({ prisma: buildPrisma(null) });
      const result = await handler.execute(makeReq());
      expect(result.skipped).toBe(true);
      expect(result.reason).toBe('invoice_not_found');
      expect(prisma.payment.upsert).not.toHaveBeenCalled();
    });
  });

  describe('execute — idempotency & guards', () => {
    it('skips silently when the webhook event was already processed (P2002)', async () => {
      const prisma = buildPrisma();
      prisma.webhookEvent.create = jest.fn().mockRejectedValue(
        new (require('@prisma/client').Prisma.PrismaClientKnownRequestError)(
          'Unique constraint failed',
          { code: 'P2002', clientVersion: '7.8.0', meta: { target: ['provider', 'eventId'] } },
        ),
      );
      const { handler, eventBus } = makeHandler({ prisma });
      const result = await handler.execute(makeReq());
      expect(prisma.payment.upsert).not.toHaveBeenCalled();
      expect(eventBus.publish).not.toHaveBeenCalled();
      expect(result.skipped).toBe(true);
      expect(result.reason).toBe('duplicate');
    });

    it('propagates a non-P2002 DB error from webhookEvent.create (transient → 5xx)', async () => {
      const prisma = buildPrisma();
      prisma.webhookEvent.create = jest.fn().mockRejectedValue(new Error('connection refused'));
      const { handler } = makeHandler({ prisma });
      await expect(handler.execute(makeReq())).rejects.toThrow(/connection refused/);
    });

    it('does not overwrite a REFUNDED payment back to COMPLETED', async () => {
      const prisma = buildPrisma();
      prisma.payment.findUnique = jest.fn().mockResolvedValue({ status: PaymentStatus.REFUNDED });
      const { handler } = makeHandler({ prisma });
      const result = await handler.execute(makeReq());
      expect(result.skipped).toBe(true);
      expect(result.reason).toBe('already_refunded');
      expect(prisma.payment.upsert).not.toHaveBeenCalled();
      expect(prisma.invoice.update).not.toHaveBeenCalled();
    });
  });

  describe('execute — context & credentials', () => {
    it('uses DEFAULT_ORG_ID for MoyasarCredentialsService decryption (single-tenant)', async () => {
      const { handler, creds } = makeHandler();
      await handler.execute(makeReq());
      expect(creds.decrypt).toHaveBeenCalledWith(FAKE_CIPHERTEXT, DEFAULT_ORG_ID);
    });

    it('enters system context for tenant resolution (bypass flag set)', async () => {
      const { handler, cls } = makeHandler();
      await handler.execute(makeReq());
      expect(cls.set).toHaveBeenCalledWith('systemContext', true);
      expect(cls.set).toHaveBeenCalledWith(TENANT_CLS_KEY, expect.objectContaining({ organizationId: DEFAULT_ORG_ID }));
    });

    it('persists Payment.amount in halalas from the re-fetched payment', async () => {
      const invoice = { ...buildInvoice(ORG_A), total: 12000 };
      const { handler, prisma } = makeHandler({
        prisma: buildPrisma(invoice),
        fetchedPayment: { id: 'moyasar-pay-1', status: 'paid', amount: 12000, currency: 'SAR' },
      });
      const result = await handler.execute(makeReq());
      expect(result.skipped).toBeUndefined();
      expect(prisma.payment.upsert).toHaveBeenCalledWith(expect.objectContaining({
        create: expect.objectContaining({ amount: 12000 }),
      }));
    });
  });

  describe('MoyasarWebhookDto validation', () => {
    it('rejects a payload whose amount is zero', async () => {
      const dto = plainToInstance(MoyasarWebhookDto, {
        id: 'pay-zero',
        status: 'paid',
        amount: 0,
        currency: 'SAR',
        metadata: { invoiceId: 'inv-1' },
      });
      const errors = await validate(dto);
      const amountErrors = errors.filter((e) => e.property === 'amount');
      expect(amountErrors.length).toBeGreaterThan(0);
    });
  });
});
