import { createHmac } from 'crypto';
import { UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { MoyasarSubscriptionWebhookHandler } from './moyasar-subscription-webhook.handler';

const TEST_SECRET = 'test-webhook-secret';
const ORG_ID = 'org-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

function sign(rawBody: string, secret = TEST_SECRET): string {
  return createHmac('sha256', secret).update(rawBody).digest('hex');
}

function buildClient(valid = true) {
  return {
    verifyWebhookSignature: jest.fn().mockReturnValue(valid),
  };
}

function buildSubscription(organizationId = ORG_ID) {
  return { id: 'sub-1', organizationId };
}

function buildInvoice(overrides?: { id?: string; amount?: number; currency?: string; subscription?: ReturnType<typeof buildSubscription> } | null) {
  if (overrides === null) return null;
  return {
    id: 'inv-sub-1',
    amount: 230,
    currency: 'SAR',
    subscription: buildSubscription(),
    ...overrides,
  };
}

interface PrismaMock {
  subscriptionInvoice: { findFirst: jest.Mock };
  webhookEvent: {
    create: jest.Mock;
    update: jest.Mock;
  };
}

function buildPrisma(invoice = buildInvoice()): PrismaMock {
  return {
    subscriptionInvoice: {
      findFirst: jest.fn().mockResolvedValue(invoice),
    },
    webhookEvent: {
      create: jest.fn().mockResolvedValue({ id: 'whe-1' }),
      update: jest.fn().mockResolvedValue({ id: 'whe-1' }),
    },
  };
}

function buildCls() {
  const store: Record<string, unknown> = {};
  return {
    run: jest.fn(async (fn: () => Promise<unknown>) => fn()),
    set: jest.fn((key: string, value: unknown) => { store[key] = value; }),
    get: jest.fn((key: string) => store[key]),
  };
}

function makeHandler(overrides: {
  clientValid?: boolean;
  invoice?: ReturnType<typeof buildInvoice>;
  prisma?: PrismaMock;
} = {}) {
  const client = buildClient(overrides.clientValid ?? true);
  const prisma = overrides.prisma ?? buildPrisma(overrides.invoice ?? buildInvoice());
  const cls = buildCls();

  const handler = new MoyasarSubscriptionWebhookHandler(
    client as never,
    prisma as never,
    cls as never,
  );

  return { handler, client, prisma, cls };
}

function p2002Error(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError(
    'Unique constraint failed on the fields: (`provider`,`eventId`)',
    { code: 'P2002', clientVersion: '7.8.0', meta: { target: ['provider', 'eventId'] } },
  );
}

describe('MoyasarSubscriptionWebhookHandler', () => {
  const validPayload = JSON.stringify({
    id: 'evt_test',
    type: 'payment_paid',
    data: { id: 'pay_test', status: 'paid', amount: 23000, currency: 'SAR' },
  });

  it('returns ok after processing a valid payment_paid event', async () => {
    const { handler } = makeHandler();
    const result = await handler.execute(Buffer.from(validPayload), sign(validPayload));
    expect(result).toEqual({ ok: true });
  });

  it('returns deduped when event is a duplicate', async () => {
    const { handler, prisma } = makeHandler();
    prisma.webhookEvent.create = jest.fn().mockRejectedValue(p2002Error());
    const result = await handler.execute(Buffer.from(validPayload), sign(validPayload));
    expect(result).toEqual({ ok: true, deduped: true });
  });

  it('throws UnauthorizedException on invalid signature', async () => {
    const { handler } = makeHandler({ clientValid: false });
    await expect(handler.execute(Buffer.from(validPayload), 'bad-sig')).rejects.toThrow(UnauthorizedException);
  });

  it('throws BadRequestException on malformed JSON', async () => {
    const { handler } = makeHandler();
    await expect(handler.execute(Buffer.from('not-json'), sign('not-json'))).rejects.toThrow('Malformed');
  });

  it('throws BadRequestException when type or data.id is missing', async () => {
    const { handler } = makeHandler();
    const badPayload = JSON.stringify({ id: 'evt_test', data: {} });
    await expect(handler.execute(Buffer.from(badPayload), sign(badPayload))).rejects.toThrow('Malformed');
  });

  it('returns ok when invoice is not found (unknown payment)', async () => {
    const { handler } = makeHandler({ invoice: null });
    const result = await handler.execute(Buffer.from(validPayload), sign(validPayload));
    expect(result).toEqual({ ok: true });
  });
});
