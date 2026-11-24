import { INestApplication, ServiceUnavailableException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { BookingStatus } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../../../src/app.module';
import { configureHttpContract } from '../../../src/common/bootstrap/configure-http-contract';
import { PrismaService } from '../../../src/infrastructure/database';
import { MoyasarCredentialsService } from '../../../src/infrastructure/payments/moyasar-credentials.service';
import {
  MoyasarApiClient,
  type MoyasarCheckoutInvoice,
  type MoyasarCheckoutInvoiceStatus,
  type MoyasarPaymentStatus,
} from '../../../src/modules/finance/moyasar-api/moyasar-api.client';
import { RedisService } from '../../../src/infrastructure/cache/redis.service';
import {
  hostedReconcileCooldownKey,
  ReconcileHostedPaymentHandler,
} from '../../../src/modules/finance/payments/client/reconcile-hosted-payment/reconcile-hosted-payment.handler';

/**
 * On-demand hosted-checkout reconcile (POST /client/payments/bookings/:id/reconcile)
 * against a real PostgreSQL: settlement, the race with the real Moyasar webhook
 * route, idempotent repeats, ownership, provider failure and the young-payment
 * guard. Only the Moyasar API client and credential decryption are replaced; the
 * handler, the settlement transaction, the webhook route and the DB are real.
 *
 * Skipped automatically when REAL_E2E_DATABASE_URL is not set (e.g. PR CI).
 */
const describeRealE2e = process.env.REAL_E2E_DATABASE_URL ? describe : describe.skip;

const WEBHOOK_SECRET = 'real-e2e-hosted-reconcile-secret';
const TOTAL_HALALAS = 23000;
const OLD_MS = 60_000;

function installInMemoryRedis(client: ReturnType<RedisService['getClient']>) {
  const store = new Map<string, number>(); // key -> expiry epoch ms (Infinity when none)
  const alive = (key: string) => {
    const expiresAt = store.get(key);
    if (expiresAt === undefined) return false;
    if (expiresAt <= Date.now()) {
      store.delete(key);
      return false;
    }
    return true;
  };
  jest.spyOn(client, 'set').mockImplementation((async (key: string, _value: unknown, ...args: unknown[]) => {
    const nx = args.includes('NX');
    const px = args.indexOf('PX');
    if (nx && alive(key)) return null;
    store.set(key, px >= 0 ? Date.now() + Number(args[px + 1]) : Infinity);
    return 'OK';
  }) as never);
  jest.spyOn(client, 'del').mockImplementation((async (...keys: string[]) =>
    keys.reduce((n, key) => n + Number(alive(key) && store.delete(key)), 0)) as never);
  // The ioredis mock has no `exists`; add it.
  (client as unknown as { exists: unknown }).exists = async (...keys: string[]) =>
    keys.filter((key) => alive(key)).length;
}

describeRealE2e('Client hosted-checkout reconcile (real e2e)', () => {
  jest.setTimeout(120_000);

  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;
  let handler: ReconcileHostedPaymentHandler;
  let previousPaymentConfig: Record<string, unknown> | null = null;

  const suffix = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  const clientIds: string[] = [];
  const bookingIds: string[] = [];
  const invoiceIds: string[] = [];
  const moyasarPaymentIds: string[] = [];
  let clientA: { id: string; token: string };
  let clientB: { id: string; token: string };

  // Moyasar fake: state per hosted invoice / payment id, inspected through jest.fn calls.
  const hostedInvoices = new Map<string, MoyasarCheckoutInvoice>();
  const gatewayPayments = new Map<string, { status: MoyasarPaymentStatus; invoiceId: string }>();
  const moyasar = {
    getCheckoutInvoice: jest.fn(async (_org: string, id: string) => {
      const found = hostedInvoices.get(id);
      if (!found) throw new Error(`unexpected hosted invoice ${id}`);
      return found;
    }),
    getPaymentStatus: jest.fn(async (_org: string, id: string) => {
      const found = gatewayPayments.get(id);
      if (!found) throw new Error(`unexpected payment ${id}`);
      return {
        id,
        status: found.status,
        amount: TOTAL_HALALAS,
        currency: 'SAR',
        refunded: 0,
        invoiceId: found.invoiceId,
      };
    }),
  };

  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.REAL_E2E_DATABASE_URL!;
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(MoyasarApiClient)
      .useValue(moyasar)
      .overrideProvider(MoyasarCredentialsService)
      .useValue({
        decrypt: jest.fn().mockReturnValue({ webhookSecret: WEBHOOK_SECRET }),
        encrypt: jest.fn().mockReturnValue('enc'),
      })
      .compile();
    // rawBody: the webhook route skips deliveries without a raw body.
    app = moduleFixture.createNestApplication({ rawBody: true });
    configureHttpContract(app, 'production');
    await app.listen(0, '127.0.0.1');
    // setup-e2e.ts mocks ioredis (set always 'OK'); give the cooldown real SET NX PX / DEL / EXISTS semantics.
    handler = app.get(ReconcileHostedPaymentHandler);
    installInMemoryRedis(redisClient());
    prisma = app.get(PrismaService);
    jwt = app.get(JwtService);
    await prisma.$queryRaw`SELECT 1`;

    previousPaymentConfig = await prisma.organizationPaymentConfig.findUnique({
      where: { singletonKey: 'singleton' },
    });
    await prisma.organizationPaymentConfig.upsert({
      where: { singletonKey: 'singleton' },
      update: { publishableKey: 'pk_test_hostedReconcile', secretKeyEnc: 'enc', webhookSecretEnc: 'enc', isLive: false },
      create: { publishableKey: 'pk_test_hostedReconcile', secretKeyEnc: 'enc', webhookSecretEnc: 'enc', isLive: false },
    });
    clientA = await seedClient('A');
    clientB = await seedClient('B');
  });

  afterAll(async () => {
    if (prisma) {
      await cleanup();
      if (previousPaymentConfig) {
        const { id, ...rest } = previousPaymentConfig as { id: string } & Record<string, never>;
        await prisma.organizationPaymentConfig.update({ where: { id }, data: rest }).catch(() => undefined);
      } else {
        await prisma.organizationPaymentConfig.deleteMany({ where: { singletonKey: 'singleton' } }).catch(() => undefined);
      }
    }
    if (app) await app.close();
  });

  beforeEach(() => {
    moyasar.getCheckoutInvoice.mockClear();
    moyasar.getPaymentStatus.mockClear();
  });

  async function cleanup() {
    await prisma.outboxEvent.deleteMany({ where: { aggregateId: { in: invoiceIds } } }).catch(() => undefined);
    await prisma.refundRequest.deleteMany({ where: { invoiceId: { in: invoiceIds } } }).catch(() => undefined);
    await prisma.webhookEvent
      .deleteMany({ where: { OR: moyasarPaymentIds.map((id) => ({ eventId: { startsWith: id } })) } })
      .catch(() => undefined);
    await prisma.payment.deleteMany({ where: { invoiceId: { in: invoiceIds } } }).catch(() => undefined);
    await prisma.invoice.deleteMany({ where: { id: { in: invoiceIds } } }).catch(() => undefined);
    await prisma.booking.deleteMany({ where: { id: { in: bookingIds } } }).catch(() => undefined);
    await prisma.client.deleteMany({ where: { id: { in: clientIds } } }).catch(() => undefined);
  }

  async function seedClient(label: string) {
    const client = await prisma.client.create({
      data: {
        name: `hr-e2e-${suffix}-${label}`,
        firstName: `hr-e2e-${suffix}-${label}`,
        phone: `+9665${String(Math.floor(10_000_000 + Math.random() * 89_999_999))}`,
        email: `hr-e2e-${suffix}-${label}@sawaa.test`,
        source: 'ONLINE',
        isActive: true,
        tokenVersion: 0,
      },
    });
    clientIds.push(client.id);
    const token = jwt.sign(
      { sub: client.id, email: client.email ?? '', namespace: 'client', jti: randomUUID(), tokenVersion: 0 },
      { secret: process.env.JWT_CLIENT_ACCESS_SECRET! },
    );
    return { id: client.id, token };
  }

  /** Hosted checkout: PENDING ONLINE_CARD payment whose gatewayRef is the Moyasar hosted invoice id. */
  async function seedHosted(opts: { owner?: { id: string }; ageMs?: number } = {}) {
    const bookingId = randomUUID();
    const invoiceId = randomUUID();
    const hostedId = `hosted_${randomUUID()}`;
    const payId = `pay_${randomUUID()}`;
    bookingIds.push(bookingId);
    invoiceIds.push(invoiceId);
    moyasarPaymentIds.push(payId);
    const owner = opts.owner ?? clientA;
    const scheduledAt = new Date(Date.now() + 48 * 3_600_000);
    await prisma.booking.create({
      data: {
        id: bookingId,
        branchId: `hr-branch-${bookingId}`,
        clientId: owner.id,
        employeeId: `hr-emp-${bookingId}`,
        serviceId: `hr-svc-${bookingId}`,
        deliveryType: 'IN_PERSON',
        status: BookingStatus.PENDING,
        scheduledAt,
        endsAt: new Date(scheduledAt.getTime() + 3_600_000),
        durationMins: 60,
        price: TOTAL_HALALAS,
        currency: 'SAR',
        bookingNumber: 800_000_000 + Math.floor(Math.random() * 1_000_000_000),
      },
    });
    await prisma.invoice.create({
      data: {
        id: invoiceId,
        branchId: `hr-branch-${bookingId}`,
        clientId: owner.id,
        employeeId: `hr-emp-${bookingId}`,
        bookingId,
        subtotal: TOTAL_HALALAS,
        vatAmt: 0,
        total: TOTAL_HALALAS,
        currency: 'SAR',
        status: 'ISSUED',
      },
    });
    const payment = await prisma.payment.create({
      data: {
        invoiceId,
        amount: TOTAL_HALALAS,
        currency: 'SAR',
        method: 'ONLINE_CARD',
        status: 'PENDING',
        gatewayRef: hostedId,
        idempotencyKey: `client:${invoiceId}`,
        updatedAt: new Date(Date.now() - (opts.ageMs ?? OLD_MS)),
      },
    });
    return { bookingId, invoiceId, hostedId, payId, paymentId: payment.id };
  }

  function provider(
    s: { hostedId: string; payId: string },
    hostedStatus: MoyasarCheckoutInvoiceStatus,
    attempt: MoyasarPaymentStatus | null,
  ) {
    hostedInvoices.set(s.hostedId, {
      id: s.hostedId,
      status: hostedStatus,
      amount: TOTAL_HALALAS,
      currency: 'SAR',
      url: 'https://checkout.test/x',
      metadata: {},
      payments: attempt ? [{ id: s.payId, status: attempt }] : [],
    });
    if (attempt) gatewayPayments.set(s.payId, { status: attempt, invoiceId: s.hostedId });
  }

  const route = (bookingId: string) => `/api/v1/client/payments/bookings/${bookingId}/reconcile`;
  const reconcileHttp = (token: string, bookingId: string) =>
    request(app.getHttpServer()).post(route(bookingId)).set('Authorization', `Bearer ${token}`);

  function webhookPayload(s: { hostedId: string; payId: string; invoiceId: string }) {
    return {
      id: `evt_${s.payId}`,
      type: 'payment_paid',
      secret_token: WEBHOOK_SECRET,
      data: {
        id: s.payId,
        status: 'paid',
        amount: TOTAL_HALALAS,
        currency: 'SAR',
        invoice_id: s.hostedId,
        metadata: { invoiceId: s.invoiceId },
      },
    };
  }
  const sendWebhook = (s: { hostedId: string; payId: string; invoiceId: string }) =>
    request(app.getHttpServer()).post('/api/v1/public/payments/webhook').send(webhookPayload(s));

  const completedEvents = (invoiceId: string) =>
    prisma.outboxEvent.count({ where: { aggregateId: invoiceId, eventType: 'finance.payment.completed' } });
  const allEvents = (invoiceId: string) => prisma.outboxEvent.count({ where: { aggregateId: invoiceId } });
  async function snapshot(s: { paymentId: string; invoiceId: string; bookingId: string }) {
    const [payment, invoice, booking, events] = await Promise.all([
      prisma.payment.findUnique({ where: { id: s.paymentId } }),
      prisma.invoice.findUnique({ where: { id: s.invoiceId } }),
      prisma.booking.findUnique({ where: { id: s.bookingId } }),
      allEvents(s.invoiceId),
    ]);
    return JSON.parse(JSON.stringify({ payment, invoice, booking, events }));
  }
  // The Redis client the handler actually uses (several modules provide a RedisService).
  const redisClient = () => (handler as unknown as { redis: RedisService }).redis.getClient();
  const clearCooldown = (s: { paymentId: string }) =>
    redisClient().del(hostedReconcileCooldownKey(s.paymentId));
  const providerCalls = () => moyasar.getCheckoutInvoice.mock.calls.length + moyasar.getPaymentStatus.mock.calls.length;

  it('(a) HTTP: settles a paid hosted invoice — payment COMPLETED, invoice PAID, one completion event', async () => {
    const s = await seedHosted();
    provider(s, 'paid', 'paid');

    const res = await reconcileHttp(clientA.token, s.bookingId);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ bookingId: s.bookingId, reconciled: true, paymentStatus: 'COMPLETED' });
    expect(await prisma.payment.findUnique({ where: { id: s.paymentId } })).toMatchObject({
      status: 'COMPLETED',
      gatewayRef: s.payId,
    });
    expect(await prisma.invoice.findUnique({ where: { id: s.invoiceId } })).toMatchObject({ status: 'PAID' });
    expect(await prisma.payment.count({ where: { invoiceId: s.invoiceId } })).toBe(1);
    // Booking confirmation rides the same outbox event the webhook stages.
    expect(await completedEvents(s.invoiceId)).toBe(1);
    const event = await prisma.outboxEvent.findFirstOrThrow({
      where: { aggregateId: s.invoiceId, eventType: 'finance.payment.completed' },
    });
    expect(event).toMatchObject({ status: 'PENDING_V2', deliveryLane: 'PENDING_V2' });
    expect(JSON.stringify(event.payload)).toContain(s.bookingId);
    const booking = await prisma.booking.findUniqueOrThrow({ where: { id: s.bookingId } });
    expect(res.body.status).toBe(booking.status);
  });

  it('(b) race: reconcile and the real webhook settle together exactly once, in varied orderings', async () => {
    const orderings: Array<{ name: string; reconcileDelay: number; webhookDelay: number }> = [
      { name: 'simultaneous', reconcileDelay: 0, webhookDelay: 0 },
      { name: 'reconcile first', reconcileDelay: 0, webhookDelay: 4 },
      { name: 'webhook first', reconcileDelay: 4, webhookDelay: 0 },
      { name: 'webhook late', reconcileDelay: 0, webhookDelay: 25 },
      { name: 'reconcile late', reconcileDelay: 25, webhookDelay: 0 },
    ];
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    for (const order of orderings) {
      const s = await seedHosted();
      provider(s, 'paid', 'paid');

      const [reconcileOutcome, webhookRes] = await Promise.all([
        wait(order.reconcileDelay).then(() => handler.execute({ clientId: clientA.id, bookingId: s.bookingId })),
        wait(order.webhookDelay).then(() => sendWebhook(s)),
      ]);

      const label = order.name;
      expect([label, webhookRes.status]).toEqual([label, 200]);
      // A skip for any reason other than losing the race would hide a broken harness.
      if (webhookRes.body.skipped === true) {
        expect([label, webhookRes.body.reason]).toEqual([label, expect.stringMatching(/invalid_transition|terminal_invoice/)]);
      }
      const webhookApplied = webhookRes.body.skipped !== true;
      expect([label, Number(reconcileOutcome.reconciled) + Number(webhookApplied)]).toEqual([label, 1]);
      expect([label, reconcileOutcome.paymentStatus]).toEqual([label, 'COMPLETED']);
      const payments = await prisma.payment.findMany({ where: { invoiceId: s.invoiceId } });
      expect([label, payments.length, payments[0]?.status]).toEqual([label, 1, 'COMPLETED']);
      expect([label, (await prisma.invoice.findUniqueOrThrow({ where: { id: s.invoiceId } })).status]).toEqual([label, 'PAID']);
      expect([label, await completedEvents(s.invoiceId)]).toEqual([label, 1]);
      expect([label, await allEvents(s.invoiceId)]).toEqual([label, 1]);
    }
  });

  it('(b2) race: a webhook that settles after reconcile read PENDING makes reconcile a harmless no-op', async () => {
    const s = await seedHosted();
    provider(s, 'paid', 'paid');
    let reachedProvider!: () => void;
    let releaseProvider!: () => void;
    const reached = new Promise<void>((resolve) => { reachedProvider = resolve; });
    const gate = new Promise<void>((resolve) => { releaseProvider = resolve; });
    moyasar.getCheckoutInvoice.mockImplementationOnce(async (_org: string, id: string) => {
      reachedProvider();
      await gate;
      return hostedInvoices.get(id)!;
    });

    // Reconcile has already read the PENDING row and is parked at the provider call.
    const reconcilePromise = handler.execute({ clientId: clientA.id, bookingId: s.bookingId });
    try {
      await reached;
      const webhookRes = await sendWebhook(s);
      expect(webhookRes.status).toBe(200);
      expect(webhookRes.body).toEqual({});
    } finally {
      releaseProvider();
    }
    const outcome = await reconcilePromise;

    expect(outcome).toMatchObject({ reconciled: false, paymentStatus: 'COMPLETED' });
    expect(await prisma.payment.count({ where: { invoiceId: s.invoiceId } })).toBe(1);
    expect(await prisma.invoice.findUniqueOrThrow({ where: { id: s.invoiceId } })).toMatchObject({ status: 'PAID' });
    expect(await completedEvents(s.invoiceId)).toBe(1);
    expect(await allEvents(s.invoiceId)).toBe(1);
  });

  it('(c) repeat: a second reconcile is a no-op without a second event or provider call', async () => {
    const s = await seedHosted();
    provider(s, 'paid', 'paid');

    const first = await handler.execute({ clientId: clientA.id, bookingId: s.bookingId });
    expect(first).toMatchObject({ reconciled: true, paymentStatus: 'COMPLETED' });
    const callsAfterFirst = providerCalls();
    const before = await snapshot(s);

    const second = await handler.execute({ clientId: clientA.id, bookingId: s.bookingId });

    expect(second).toMatchObject({ reconciled: false, paymentStatus: 'COMPLETED' });
    expect(providerCalls()).toBe(callsAfterFirst);
    expect(await snapshot(s)).toEqual(before);
    expect(await completedEvents(s.invoiceId)).toBe(1);
  });

  it("(d) HTTP: another client's session, or an unknown booking id, gets 404 with no writes and no provider call", async () => {
    const s = await seedHosted({ owner: clientA });
    provider(s, 'paid', 'paid');
    const before = await snapshot(s);

    const foreign = await reconcileHttp(clientB.token, s.bookingId);
    const unknown = await reconcileHttp(clientB.token, randomUUID());
    const anonymous = await request(app.getHttpServer()).post(route(s.bookingId));

    expect(foreign.status).toBe(404);
    expect(unknown.status).toBe(404);
    expect(anonymous.status).toBe(401);
    expect(providerCalls()).toBe(0);
    expect(await snapshot(s)).toEqual(before);
    expect(before.payment.status).toBe('PENDING');
  });

  it('(e) HTTP: a provider failure answers 200 reconciled=false and leaves the DB untouched', async () => {
    const s = await seedHosted();
    provider(s, 'paid', 'paid');
    const before = await snapshot(s);

    moyasar.getCheckoutInvoice.mockRejectedValueOnce(new ServiceUnavailableException('moyasar 503'));
    await clearCooldown(s);
    const checkoutDown = await reconcileHttp(clientA.token, s.bookingId);
    expect(checkoutDown.status).toBe(200);
    expect(checkoutDown.body).toMatchObject({ reconciled: false, paymentStatus: 'PENDING' });
    expect(await snapshot(s)).toEqual(before);

    await clearCooldown(s);
    moyasar.getPaymentStatus.mockRejectedValueOnce(new Error('moyasar timeout'));
    const paymentLookupDown = await reconcileHttp(clientA.token, s.bookingId);
    expect(paymentLookupDown.status).toBe(200);
    expect(paymentLookupDown.body).toMatchObject({ reconciled: false, paymentStatus: 'PENDING' });
    expect(await snapshot(s)).toEqual(before);

    // The provider was genuinely asked both times, and recovery works afterwards.
    expect(moyasar.getCheckoutInvoice).toHaveBeenCalledTimes(2);
    await clearCooldown(s);
    const recovered = await handler.execute({ clientId: clientA.id, bookingId: s.bookingId });
    expect(recovered).toMatchObject({ reconciled: true, paymentStatus: 'COMPLETED' });
  });

  it('(f) a payment younger than the minimum age is left to the webhook: no provider call, no write', async () => {
    const s = await seedHosted({ ageMs: 1_000 });
    provider(s, 'paid', 'paid');
    const before = await snapshot(s);

    const outcome = await handler.execute({ clientId: clientA.id, bookingId: s.bookingId });

    expect(outcome).toMatchObject({ reconciled: false, paymentStatus: 'PENDING' });
    expect(providerCalls()).toBe(0);
    expect(await snapshot(s)).toEqual(before);
  });

  it('(h) two reconciles on one payment inside the cooldown ask the provider once; the second returns current state', async () => {
    const s = await seedHosted();
    provider(s, 'initiated', null); // nothing terminal yet, so the payment stays PENDING

    const first = await handler.execute({ clientId: clientA.id, bookingId: s.bookingId });
    expect(first).toMatchObject({ reconciled: false, paymentStatus: 'PENDING' });
    expect(moyasar.getCheckoutInvoice).toHaveBeenCalledTimes(1);

    provider(s, 'paid', 'paid'); // would settle, but the cooldown must keep the provider unasked
    const before = await snapshot(s);
    const second = await reconcileHttp(clientA.token, s.bookingId);

    expect(second.status).toBe(200);
    expect(second.body).toMatchObject({ reconciled: false, paymentStatus: 'PENDING' });
    expect(providerCalls()).toBe(1);
    expect(await snapshot(s)).toEqual(before);

    await clearCooldown(s); // simulates the window elapsing
    const third = await handler.execute({ clientId: clientA.id, bookingId: s.bookingId });
    expect(third).toMatchObject({ reconciled: true, paymentStatus: 'COMPLETED' });
  });

  it('(i) the cooldown is per payment: another payment is not blocked by it', async () => {
    const one = await seedHosted();
    const two = await seedHosted();
    provider(one, 'initiated', null);
    provider(two, 'paid', 'paid');
    await handler.execute({ clientId: clientA.id, bookingId: one.bookingId });
    const outcome = await handler.execute({ clientId: clientA.id, bookingId: two.bookingId });
    expect(outcome).toMatchObject({ reconciled: true, paymentStatus: 'COMPLETED' });
  });

  it('(j) Redis failure fails closed: no provider call, DB unchanged, no lock left behind', async () => {
    const s = await seedHosted();
    provider(s, 'paid', 'paid');
    const before = await snapshot(s);
    const client = redisClient();
    // Direct handler call: an HTTP request would let other Redis users consume the one-shot rejection.
    (client.set as jest.Mock).mockRejectedValueOnce(new Error('ECONNREFUSED'));
    const res = await handler.execute({ clientId: clientA.id, bookingId: s.bookingId });
    expect(res).toMatchObject({ reconciled: false, paymentStatus: 'PENDING' });
    expect(providerCalls()).toBe(0);
    expect(await snapshot(s)).toEqual(before);
    expect(await client.exists(hostedReconcileCooldownKey(s.paymentId))).toBe(0);
    // Redis back: the same payment settles on the next call.
    expect(await handler.execute({ clientId: clientA.id, bookingId: s.bookingId })).toMatchObject({ reconciled: true });
  });

  it('(g) a dead hosted invoice with only a failed attempt fails the payment once; an open one stays PENDING', async () => {
    const dead = await seedHosted();
    provider(dead, 'expired', 'failed');
    const failed = await handler.execute({ clientId: clientA.id, bookingId: dead.bookingId });
    expect(failed).toMatchObject({ reconciled: true, paymentStatus: 'FAILED' });
    expect(await prisma.payment.findUnique({ where: { id: dead.paymentId } })).toMatchObject({ status: 'FAILED' });
    expect(await prisma.invoice.findUnique({ where: { id: dead.invoiceId } })).toMatchObject({ status: 'ISSUED' });
    expect(
      await prisma.outboxEvent.count({ where: { aggregateId: dead.invoiceId, eventType: 'finance.payment.failed' } }),
    ).toBe(1);
    expect(await completedEvents(dead.invoiceId)).toBe(0);
    const again = await handler.execute({ clientId: clientA.id, bookingId: dead.bookingId });
    expect(again).toMatchObject({ reconciled: false, paymentStatus: 'FAILED' });
    expect(await allEvents(dead.invoiceId)).toBe(1);

    const open = await seedHosted();
    provider(open, 'initiated', 'failed');
    const before = await snapshot(open);
    moyasar.getPaymentStatus.mockClear();
    const retryable = await handler.execute({ clientId: clientA.id, bookingId: open.bookingId });
    expect(retryable).toMatchObject({ reconciled: false, paymentStatus: 'PENDING' });
    expect(moyasar.getPaymentStatus).not.toHaveBeenCalled();
    expect(await snapshot(open)).toEqual(before);
  });
});
