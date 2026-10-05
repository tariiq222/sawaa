/**
 * Real PostgreSQL accounting races; no provider money movement.
 * Requires REAL_E2E_DATABASE_URL for a migrated disposable test database.
 * Gateway fixtures have durable CONFIRMED provider evidence before the race.
 */
import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '@prisma/client';
import { ManualRefundPaymentHandler } from '../../../src/modules/finance/refund-payment/manual-refund-payment.handler';
import { RefundPaymentHandler } from '../../../src/modules/finance/refund-payment/refund-payment.handler';
import { getRealE2eDatabaseUrl } from '../../helpers/create-real-e2e-app';

const describeRealE2e = process.env.REAL_E2E_DATABASE_URL ? describe : describe.skip;
type RefundPath = 'manual' | 'reviewed' | 'gateway' | 'legacy';
type TransactionPort = {
  withTransaction: <T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) => Promise<T>;
};
const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
};

describeRealE2e('Invoice refund aggregation under concurrency (real PostgreSQL)', () => {
  jest.setTimeout(45_000);
  let fixture: PrismaClient;
  let firstClient: PrismaClient;
  let secondClient: PrismaClient;
  const secondApplication = `refund-second-${randomUUID()}`;
  const provider = {
    createRefund: jest.fn(() => { throw new Error('Provider POST is forbidden in accounting tests'); }),
    getPaymentStatus: jest.fn(() => { throw new Error('Provider GET is forbidden in accounting tests'); }),
  };

  const createClient = (applicationName: string) => {
    const url = new URL(getRealE2eDatabaseUrl());
    url.searchParams.set('application_name', applicationName);
    return new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString() }) });
  };

  const transaction = (
    client: PrismaClient,
    held?: ReturnType<typeof deferred>,
    release?: ReturnType<typeof deferred>,
  ): TransactionPort => ({
    withTransaction: fn => client.$transaction(async rawTx => {
      // Pause the first writer after reading its invoice aggregate. Without
      // serialization the second writer reads the same total or commits first,
      // and the first writer subsequently overwrites that refund's aggregate.
      const tx = new Proxy(rawTx, {
        get(target, property, receiver) {
          if (property !== 'invoice' || !held || !release) return Reflect.get(target, property, receiver);
          return new Proxy(target.invoice, {
            get(invoice, method, invoiceReceiver) {
              if (method !== 'findUniqueOrThrow') return Reflect.get(invoice, method, invoiceReceiver);
              return async (args: Parameters<typeof invoice.findUniqueOrThrow>[0]) => {
                const result = await invoice.findUniqueOrThrow(args);
                held.resolve();
                await release.promise;
                return result;
              };
            },
          });
        },
      });
      return fn(tx);
    }, { timeout: 20_000 }),
  });

  const waitForBlockedOrSettled = async (isSettled: () => boolean) => {
    const deadline = Date.now() + 5_000;
    while (Date.now() < deadline) {
      if (isSettled()) return;
      const [row] = await fixture.$queryRaw<Array<{ waiting: boolean }>>`
        SELECT EXISTS (SELECT 1 FROM pg_stat_activity
          WHERE application_name = ${secondApplication} AND wait_event_type = 'Lock') AS waiting
      `;
      if (row.waiting) return;
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    throw new Error('Second refund neither reached a database lock nor settled');
  };

  beforeAll(async () => {
    fixture = createClient(`refund-fixture-${randomUUID()}`);
    firstClient = createClient(`refund-first-${randomUUID()}`);
    secondClient = createClient(secondApplication);
    await Promise.all([fixture.$connect(), firstClient.$connect(), secondClient.$connect()]);
  });
  afterAll(async () => {
    await Promise.all([fixture?.$disconnect(), firstClient?.$disconnect(), secondClient?.$disconnect()]);
  });

  it.each<[RefundPath, RefundPath]>([
    ['manual', 'manual'], ['gateway', 'gateway'], ['manual', 'gateway'],
    ['gateway', 'manual'], ['reviewed', 'gateway'], ['legacy', 'manual'],
  ])('retains both different-payment refunds with %s then %s', async (firstPath, secondPath) => {
    const invoice = await fixture.invoice.create({ data: {
      branchId: randomUUID(), clientId: randomUUID(), employeeId: randomUUID(), bookingId: randomUUID(),
      subtotal: 8800, total: 10000, vatRate: 0, vatAmt: 1200, status: 'PAID',
    } });
    const firstHeld = deferred();
    const releaseFirst = deferred();
    const running: Promise<unknown>[] = [];
    try {
      const prepare = async (path: RefundPath, amount: number) => {
        const gateway = path === 'gateway' || path === 'legacy';
        const payment = await fixture.payment.create({ data: {
          invoiceId: invoice.id, amount, method: gateway ? 'ONLINE_CARD' : 'CASH',
          status: 'COMPLETED', gatewayRef: gateway ? randomUUID() : null,
        } });
        const request = path === 'manual' ? null : await fixture.refundRequest.create({ data: {
          invoiceId: invoice.id, clientId: invoice.clientId, paymentId: payment.id, amount,
          status: path === 'reviewed' ? 'PENDING_REVIEW' : 'PROCESSING',
          providerState: path === 'reviewed' ? 'BEFORE_CALL' : 'CONFIRMED',
          gatewayRef: payment.gatewayRef, idempotencyKey: `refund:${randomUUID()}`,
          baselineRefundedAmount: 0, targetCumulativeRefundedAmount: amount,
          observedCumulativeRefundedAmount: amount,
        } });
        return { payment, request };
      };
      const first = await prepare(firstPath, 4000);
      const second = await prepare(secondPath, 6000);
      const refund = (path: RefundPath, client: PrismaClient, tx: TransactionPort, data: Awaited<ReturnType<typeof prepare>>) => {
        if (path === 'manual' || path === 'reviewed') {
          return new ManualRefundPaymentHandler(client as never, tx as never, {} as never).execute({
            paymentId: data.payment.id, reason: 'Concurrency fixture refund',
            ...(data.request ? { refundRequestId: data.request.id } : {}),
          });
        }
        const handler = new RefundPaymentHandler(client as never, tx as never, {} as never, provider as never);
        return path === 'legacy'
          ? handler.finalizeRefund(data.request!.id, data.request!.idempotencyKey!, data.payment.gatewayRef!)
          : handler.finalizeRefundFromCancellation({ refundRequestId: data.request!.id, idempotencyKey: data.request!.idempotencyKey! });
      };
      const firstRun = refund(firstPath, firstClient, transaction(firstClient, firstHeld, releaseFirst), first);
      running.push(firstRun);
      // Propagate an early failure instead of waiting forever for the read gate.
      await Promise.race([firstHeld.promise, firstRun.then(() => { throw new Error('First refund did not reach the invoice read'); })]);
      let secondSettled = false;
      const secondRun = refund(secondPath, secondClient, transaction(secondClient), second);
      running.push(secondRun);
      void secondRun.then(() => { secondSettled = true; }, () => { secondSettled = true; });
      await waitForBlockedOrSettled(() => secondSettled);
      releaseFirst.resolve();
      await Promise.all(running);

      const updated = await fixture.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
      expect(Number(updated.refundedAmount)).toBe(10000);
      expect(Number(updated.refundedVatAmt)).toBe(1200);
      expect(updated.status).toBe('REFUNDED');
      const payments = await fixture.payment.findMany({ where: { invoiceId: invoice.id } });
      expect(payments).toHaveLength(2);
      for (const payment of payments) {
        expect(payment.status).toBe('REFUNDED');
        expect(Number(payment.refundedAmount)).toBe(Number(payment.amount));
      }
      const requests = await fixture.refundRequest.findMany({ where: { invoiceId: invoice.id } });
      expect(requests).toHaveLength(2);
      expect(requests.every(request => request.status === 'COMPLETED')).toBe(true);
      expect(requests.reduce((sum, request) => sum + Number(request.amount), 0)).toBe(10000);
      expect(provider.createRefund).not.toHaveBeenCalled();
      expect(provider.getPaymentStatus).not.toHaveBeenCalled();
    } finally {
      releaseFirst.resolve();
      await Promise.allSettled(running);
      const requests = await fixture.refundRequest.findMany({ where: { invoiceId: invoice.id }, select: { id: true } });
      await fixture.outboxEvent.deleteMany({ where: { aggregateId: { in: requests.map(request => request.id) } } });
      await fixture.refundRequest.deleteMany({ where: { invoiceId: invoice.id } });
      await fixture.payment.deleteMany({ where: { invoiceId: invoice.id } });
      await fixture.invoice.delete({ where: { id: invoice.id } });
    }
  });
});
