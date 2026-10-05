import { INestApplication, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ClsService } from 'nestjs-cls';
import { randomUUID } from 'node:crypto';
import { AppModule } from '../../../src/app.module';
import {
  PrismaService,
  RlsTransactionService,
} from '../../../src/infrastructure/database';
import { InitNativePaymentHandler } from '../../../src/modules/finance/native-payments/init-native-payment/init-native-payment.handler';
import { ReconcileNativePaymentHandler } from '../../../src/modules/finance/native-payments/reconcile-native-payment/reconcile-native-payment.handler';
import { MoyasarPaymentSettlementHandler } from '../../../src/modules/finance/moyasar-payment-settlement/moyasar-payment-settlement.handler';
import { MoyasarWebhookHandler } from '../../../src/modules/finance/moyasar-webhook/moyasar-webhook.handler';
import { InitClientPaymentHandler } from '../../../src/modules/finance/payments/client/init-client-payment/init-client-payment.handler';

const describeRealE2e = process.env.REAL_E2E_DATABASE_URL
  ? describe
  : describe.skip;
describeRealE2e(
  'Native payment reservations and settlement — real PostgreSQL',
  () => {
    jest.setTimeout(60_000);
    let app: INestApplication;
    let prisma: PrismaService;
    let rls: RlsTransactionService;
    const invoiceIds: string[] = [];
    const paymentIds: string[] = [];
    const clientId = `native-race-${randomUUID()}`;
    const config = {
      enabled: true,
      isLive: false,
      publishableKey: 'pk_test_race',
      applePay: null,
      supportedNetworks: ['mada', 'visa', 'mastercard'],
    };
    beforeAll(async () => {
      process.env.DATABASE_URL = process.env.REAL_E2E_DATABASE_URL!;
      const module = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();
      app = module.createNestApplication();
      await app.init();
      prisma = app.get(PrismaService);
      rls = app.get(RlsTransactionService);
    });
    afterAll(async () => {
      if (prisma) {
        await prisma.outboxEvent.deleteMany({
          where: { aggregateId: { in: invoiceIds } },
        });
        await prisma.webhookEvent.deleteMany({
          where: {
            provider: 'MOYASAR_TENANT',
            eventId: { in: paymentIds.map((id) => `${id}:paid`) },
          },
        });
        await prisma.payment.deleteMany({
          where: { invoiceId: { in: invoiceIds } },
        });
        await prisma.invoice.deleteMany({ where: { id: { in: invoiceIds } } });
      }
      if (app) await app.close();
    });
    async function invoice() {
      const id = randomUUID();
      invoiceIds.push(id);
      return prisma.invoice.create({
        data: {
          id,
          clientId,
          branchId: `branch-${id}`,
          employeeId: '',
          packagePurchaseId: `purchase-${id}`,
          subtotal: 230,
          total: 230,
          vatAmt: 0,
          status: 'ISSUED',
        },
      });
    }
    function build() {
      const gateway = {
        getPaymentStatus: jest.fn().mockRejectedValue(new NotFoundException()),
        getCheckoutInvoice: jest.fn(),
        findCheckoutInvoiceByMetadata: jest.fn().mockResolvedValue(null),
        createCheckoutInvoice: jest.fn(async (_org: string, params: any) => ({
          id: randomUUID(),
          status: 'initiated',
          amount: params.amountHalalas,
          currency: 'SAR',
          url: 'https://checkout.test/example',
          metadata: params.metadata,
          payments: [],
        })),
      };
      const settlement = new MoyasarPaymentSettlementHandler(prisma, rls);
      const reconcile = new ReconcileNativePaymentHandler(
        prisma,
        gateway as never,
        settlement,
      );
      const native = new InitNativePaymentHandler(
        prisma,
        rls,
        { getPaymentConfiguration: async () => config } as never,
        reconcile,
        gateway as never,
      );
      const proxy = new Proxy(prisma, {
        get(target, key, receiver) {
          if (key === 'organizationSettings')
            return { findFirst: async () => ({ paymentMoyasarEnabled: true }) };
          if (key === 'organizationPaymentConfig')
            return {
              findUnique: async () => ({ webhookSecretEnc: 'test-only' }),
            };
          const value = Reflect.get(target, key, receiver);
          return typeof value === 'function' ? value.bind(prisma) : value;
        },
      });
      const hosted = new InitClientPaymentHandler(proxy, gateway as never, rls);
      const webhook = new MoyasarWebhookHandler(
        proxy,
        app.get(ClsService),
        { decrypt: () => ({ webhookSecret: 'test-only' }) } as never,
        gateway as never,
        settlement,
      );
      return { gateway, native, hosted, reconcile, webhook };
    }
    it('concurrent native init and provider 404 retries reuse one bound UUID', async () => {
      const inv = await invoice();
      const { native } = build();
      const results = await Promise.all(
        Array.from({ length: 6 }, () =>
          native.execute({ clientId, invoiceId: inv.id }),
        ),
      );
      expect(new Set(results.map((result) => result.paymentId)).size).toBe(1);
      const rows = await prisma.payment.findMany({
        where: { invoiceId: inv.id },
      });
      expect(rows).toHaveLength(1);
      expect(rows[0].gatewayRef).toBe(rows[0].id);
      expect(rows[0].nativeConfigFingerprint).toBeTruthy();
    });
    it('simultaneous native and hosted init cannot reserve two charges', async () => {
      const inv = await invoice();
      const { native, hosted } = build();
      const results = await Promise.allSettled([
        native.execute({ clientId, invoiceId: inv.id }),
        hosted.execute({ clientId, invoiceId: inv.id }),
      ]);
      expect(
        results.filter((result) => result.status === 'fulfilled'),
      ).toHaveLength(1);
      expect(
        results.filter((result) => result.status === 'rejected'),
      ).toHaveLength(1);
      expect(await prisma.payment.count({ where: { invoiceId: inv.id } })).toBe(
        1,
      );
    });
    it('rejects a hosted reservation winning after FAILED commits but before native replacement', async () => {
      const inv = await invoice();
      const { native, hosted, reconcile, gateway } = build();
      const first = await native.execute({ clientId, invoiceId: inv.id });
      gateway.getPaymentStatus.mockResolvedValue({
        id: first.paymentId,
        status: 'failed',
        amount: 230,
        currency: 'SAR',
        refunded: 0,
      });
      let signalFailed!: () => void;
      let releaseReplacement!: () => void;
      const failedCommitted = new Promise<void>((resolve) => {
        signalFailed = resolve;
      });
      const release = new Promise<void>((resolve) => {
        releaseReplacement = resolve;
      });
      const original = reconcile.execute.bind(reconcile);
      jest.spyOn(reconcile, 'execute').mockImplementation(async (command) => {
        const result = await original(command);
        signalFailed();
        await release;
        return result;
      });
      const retry = native.execute({ clientId, invoiceId: inv.id });
      await failedCommitted;
      let winner: Awaited<ReturnType<typeof hosted.execute>>;
      try {
        winner = await hosted.execute({ clientId, invoiceId: inv.id });
      } finally {
        releaseReplacement();
      }
      await expect(retry).rejects.toMatchObject({
        response: expect.objectContaining({
          code: 'HOSTED_PAYMENT_IN_PROGRESS',
        }),
      });
      const pending = await prisma.payment.findMany({
        where: { invoiceId: inv.id, status: 'PENDING' },
      });
      expect(pending).toHaveLength(1);
      expect(pending[0].id).toBe(winner!.paymentId);
      expect(pending[0].gatewayRef).not.toBe(pending[0].id);
      expect(
        (
          await prisma.payment.findUniqueOrThrow({
            where: { id: first.paymentId },
          })
        ).status,
      ).toBe('FAILED');
    });

    it('retains a failed UUID and never routes its late callback onto the retry', async () => {
      const inv = await invoice();
      const { native, gateway, webhook } = build();
      const first = await native.execute({ clientId, invoiceId: inv.id });
      paymentIds.push(first.paymentId);
      gateway.getPaymentStatus.mockResolvedValue({
        id: first.paymentId,
        status: 'failed',
        amount: 230,
        currency: 'SAR',
        refunded: 0,
      });
      const retry = await native.execute({ clientId, invoiceId: inv.id });
      expect(retry.paymentId).not.toBe(first.paymentId);
      expect(await prisma.payment.count({ where: { invoiceId: inv.id } })).toBe(
        2,
      );
      expect(
        (
          await prisma.payment.findUniqueOrThrow({
            where: { id: first.paymentId },
          })
        ).status,
      ).toBe('FAILED');
      gateway.getPaymentStatus.mockResolvedValue({
        id: first.paymentId,
        status: 'paid',
        amount: 230,
        currency: 'SAR',
        refunded: 0,
      });
      const payload = {
        id: first.paymentId,
        status: 'paid',
        amount: 230,
        currency: 'SAR',
        metadata: { invoiceId: inv.id },
        secret_token: 'test-only',
      };
      await webhook.execute({
        payload: payload as never,
        rawBody: JSON.stringify(payload),
        signature: '',
      });
      expect(
        (
          await prisma.payment.findUniqueOrThrow({
            where: { id: retry.paymentId },
          })
        ).status,
      ).toBe('PENDING');
      expect(
        await prisma.outboxEvent.count({
          where: {
            aggregateId: inv.id,
            eventType: 'finance.payment.completed',
          },
        }),
      ).toBe(0);
    });

    it('simultaneous authenticated reconcile and signed webhook stage completion only once', async () => {
      const inv = await invoice();
      const { native, reconcile, webhook, gateway } = build();
      const attempt = await native.execute({ clientId, invoiceId: inv.id });
      paymentIds.push(attempt.paymentId);
      gateway.getPaymentStatus.mockResolvedValue({
        id: attempt.paymentId,
        status: 'paid',
        amount: 230,
        currency: 'SAR',
        refunded: 0,
      });
      const payload = {
        id: attempt.paymentId,
        status: 'paid',
        amount: 230,
        currency: 'SAR',
        metadata: { invoiceId: inv.id },
        secret_token: 'test-only',
      };
      await Promise.all([
        reconcile.execute({ clientId, paymentId: attempt.paymentId }),
        webhook.execute({
          payload: payload as never,
          rawBody: JSON.stringify(payload),
          signature: '',
        }),
      ]);
      expect(
        (
          await prisma.payment.findUniqueOrThrow({
            where: { id: attempt.paymentId },
          })
        ).status,
      ).toBe('COMPLETED');
      expect(
        await prisma.outboxEvent.count({
          where: {
            aggregateId: inv.id,
            eventType: 'finance.payment.completed',
          },
        }),
      ).toBe(1);
      await reconcile.execute({ clientId, paymentId: attempt.paymentId });
      expect(
        await prisma.outboxEvent.count({ where: { aggregateId: inv.id } }),
      ).toBe(1);
    });
  },
);
