import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PaymentStatus, Prisma, RefundStatus } from '@prisma/client';
import { DEFAULT_ORG_ID } from '../../../common/constants';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { EventBusService } from '../../../infrastructure/events';
import { MoyasarApiClient } from '../moyasar-api/moyasar-api.client';
import { RefundPaymentHandler } from './refund-payment.handler';

jest.mock('node:crypto', () => ({
  ...jest.requireActual('node:crypto'),
  randomUUID: jest.fn().mockReturnValue('11111111-1111-4111-8111-111111111111'),
}));

describe('RefundPaymentHandler', () => {
  let handler: RefundPaymentHandler;
  let prisma: any;
  let moyasar: { createRefund: jest.Mock; getPaymentStatus: jest.Mock };

  const invoice = (overrides: Record<string, unknown> = {}) => ({
    id: 'invoice-1', bookingId: 'booking-1', clientId: 'client-1', currency: 'SAR',
    total: new Prisma.Decimal(100), vatAmt: new Prisma.Decimal(15),
    refundedAmount: new Prisma.Decimal(40),
    ...overrides,
  });
  const payment = (refundedAmount = 40, overrides: Record<string, unknown> = {}) => ({
    id: 'payment-1', gatewayRef: 'gateway-payment-1', amount: new Prisma.Decimal(100),
    refundedAmount: new Prisma.Decimal(refundedAmount), currency: 'SAR',
    ...overrides,
  });
  const processing = (overrides: Record<string, unknown> = {}) => ({
    id: 'refund-1', paymentId: 'payment-1', invoiceId: 'invoice-1',
    amount: new Prisma.Decimal(20), status: RefundStatus.PROCESSING,
    gatewayRef: null, idempotencyKey: 'refund:refund-1', sourceEventId: null,
    providerState: 'BEFORE_CALL', providerLeaseOwner: null, providerLeaseExpiresAt: null,
    baselineRefundedAmount: null, targetCumulativeRefundedAmount: null,
    observedCumulativeRefundedAmount: null,
    ...overrides,
  });
  const providerPayment = (refunded: number, overrides: Record<string, unknown> = {}) => ({
    id: 'gateway-payment-1', status: 'paid', amount: 100, refunded, currency: 'SAR',
    ...overrides,
  });
  const providerRefund = (refunded: number, overrides: Record<string, unknown> = {}) => ({
    id: 'gateway-payment-1', paymentId: 'gateway-payment-1', status: 'refunded',
    amount: 20, refunded, currency: 'SAR', createdAt: '2026-08-13T10:00:00.000Z',
    ...overrides,
  });

  beforeEach(async () => {
    prisma = {
      refundRequest: {
        findUnique: jest.fn().mockResolvedValue(null),
        findUniqueOrThrow: jest.fn(),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'refund-1' }),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      payment: {
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn().mockResolvedValue(payment()),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      invoice: {
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn().mockResolvedValue(invoice()),
        update: jest.fn().mockResolvedValue({}),
      },
      outboxEvent: { create: jest.fn().mockResolvedValue({}) },
      $queryRaw: jest.fn(),
      $transaction: jest.fn(),
    };
    prisma.$transaction.mockImplementation(async (work: (tx: typeof prisma) => Promise<unknown>) => work(prisma));
    moyasar = {
      createRefund: jest.fn().mockResolvedValue(providerRefund(60)),
      getPaymentStatus: jest.fn().mockResolvedValue(providerPayment(40)),
    };
    const module = await Test.createTestingModule({
      providers: [
        RefundPaymentHandler,
        { provide: PrismaService, useValue: prisma },
        {
          provide: RlsTransactionService,
          useValue: {
            withTransaction: (work: (tx: typeof prisma) => Promise<unknown>) => prisma.$transaction(work),
            withBypassTransaction: (work: (tx: typeof prisma) => Promise<unknown>) => prisma.$transaction(work),
          },
        },
        { provide: EventBusService, useValue: { publish: jest.fn() } },
        { provide: MoyasarApiClient, useValue: moyasar },
      ],
    }).compile();
    handler = module.get(RefundPaymentHandler);
  });

  it('returns a public numeric refund amount and null for a missing request', async () => {
    prisma.refundRequest.findUnique
      .mockResolvedValueOnce({
        id: 'refund-1', paymentId: 'payment-1', amount: new Prisma.Decimal(12345),
        status: RefundStatus.PROCESSING, gatewayRef: null,
      })
      .mockResolvedValueOnce(null);

    await expect(handler.getRefundRequest({ id: 'refund-1' })).resolves.toEqual({
      id: 'refund-1', paymentId: 'payment-1', amount: 12345,
      status: RefundStatus.PROCESSING, gatewayRef: null,
    });
    await expect(handler.getRefundRequest({ id: 'missing' })).resolves.toBeNull();
  });

  it('does not invent a refund idempotency header contract for the legacy provider wrapper', async () => {
    moyasar.createRefund.mockResolvedValue({ id: 'gateway-payment-1' });
    await handler.callMoyasarAndFinalize('gateway-payment-1', 15055, 'internal-ledger-key', 'org-1');
    expect(moyasar.createRefund).toHaveBeenCalledWith('org-1', {
      paymentId: 'gateway-payment-1', amount: 15055,
    });
  });

  describe('createRefundRequestInTx', () => {
    const rawPayment = (overrides: Record<string, unknown> = {}) => ({
      id: 'payment-1', status: PaymentStatus.COMPLETED, gatewayRef: 'gateway-payment-1',
      amount: new Prisma.Decimal(100), refundedAmount: new Prisma.Decimal(0),
      invoiceId: 'invoice-1', ...overrides,
    });

    it('rejects missing, non-refundable, in-flight and over-refund requests under the payment lock', async () => {
      prisma.$queryRaw.mockResolvedValueOnce([]);
      await expect(handler.createRefundRequestInTx(prisma, {
        paymentId: 'missing', reason: 'cancel',
      })).rejects.toThrow(NotFoundException);

      prisma.$queryRaw.mockResolvedValueOnce([rawPayment({ status: PaymentStatus.PENDING })]);
      await expect(handler.createRefundRequestInTx(prisma, {
        paymentId: 'payment-1', reason: 'cancel',
      })).rejects.toThrow(BadRequestException);

      prisma.$queryRaw.mockResolvedValueOnce([rawPayment()]);
      prisma.refundRequest.findFirst.mockResolvedValueOnce({ id: 'in-flight' });
      await expect(handler.createRefundRequestInTx(prisma, {
        paymentId: 'payment-1', reason: 'cancel',
      })).rejects.toThrow('already processing');

      prisma.$queryRaw.mockResolvedValueOnce([rawPayment({ refundedAmount: new Prisma.Decimal(80) })]);
      prisma.refundRequest.findFirst.mockResolvedValueOnce(null);
      prisma.invoice.findUniqueOrThrow.mockResolvedValueOnce(invoice());
      await expect(handler.createRefundRequestInTx(prisma, {
        paymentId: 'payment-1', reason: 'cancel', amount: 21,
      })).rejects.toThrow('refundable balance');
    });

    it('settles off-gateway refunds entirely inside the caller transaction', async () => {
      prisma.$queryRaw.mockResolvedValue([rawPayment({ gatewayRef: null })]);
      prisma.invoice.findUniqueOrThrow.mockResolvedValue(invoice({ refundedAmount: 0 }));

      const result = await handler.createRefundRequestInTx(prisma, {
        paymentId: 'payment-1', reason: 'cash cancellation',
      });

      expect(result.payment.gatewayRef).toBeNull();
      expect(prisma.refundRequest.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          status: RefundStatus.COMPLETED, providerState: 'CONFIRMED',
        }),
      }));
      expect(prisma.payment.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ refundedAmount: { increment: 100 } }),
      }));
      expect(moyasar.createRefund).not.toHaveBeenCalled();
    });

    it('persists a gateway refund in BEFORE_CALL with a durable source event before any provider call', async () => {
      prisma.$queryRaw.mockResolvedValue([rawPayment()]);
      prisma.invoice.findUniqueOrThrow.mockResolvedValue(invoice());

      const result = await handler.createRefundRequestInTx(prisma, {
        paymentId: 'payment-1', reason: 'booking cancellation', amount: 20,
        sourceEventId: '22222222-2222-4222-8222-222222222222',
      });

      expect(result.refundRequestId).toBe('11111111-1111-4111-8111-111111111111');
      expect(prisma.refundRequest.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          status: RefundStatus.PROCESSING,
          providerState: 'BEFORE_CALL',
          sourceEventId: '22222222-2222-4222-8222-222222222222',
        }),
      }));
      expect(moyasar.createRefund).not.toHaveBeenCalled();
    });
  });

  describe('official cumulative-refund reconciliation', () => {
    it('returns terminal COMPLETED/MANUAL_REVIEW without a lease or provider call', async () => {
      prisma.refundRequest.findUniqueOrThrow
        .mockResolvedValueOnce(processing({ status: RefundStatus.COMPLETED }))
        .mockResolvedValueOnce(processing({
          status: RefundStatus.MANUAL_REVIEW, providerState: 'MANUAL_REVIEW',
        }));

      await handler.finalizeRefundFromCancellation({
        refundRequestId: 'refund-1', idempotencyKey: 'refund:refund-1',
      });
      await handler.finalizeRefundFromCancellation({
        refundRequestId: 'refund-1', idempotencyKey: 'refund:refund-1',
      });

      expect(prisma.refundRequest.updateMany).not.toHaveBeenCalled();
      expect(moyasar.getPaymentStatus).not.toHaveBeenCalled();
      expect(moyasar.createRefund).not.toHaveBeenCalled();
    });

    it('requires exactly one lease winner before any provider GET or POST', async () => {
      prisma.refundRequest.findUniqueOrThrow.mockResolvedValue(processing());
      prisma.refundRequest.updateMany.mockResolvedValueOnce({ count: 0 });

      await expect(handler.finalizeRefundFromCancellation({
        refundRequestId: 'refund-1', idempotencyKey: 'refund:refund-1',
      })).rejects.toThrow(ConflictException);

      expect(moyasar.getPaymentStatus).not.toHaveBeenCalled();
      expect(moyasar.createRefund).not.toHaveBeenCalled();
    });

    it('records a prior-partial baseline and target before one POST, then commits accounting and outbox', async () => {
      prisma.refundRequest.findUniqueOrThrow.mockResolvedValue(processing());
      prisma.payment.findUniqueOrThrow.mockResolvedValue(payment(40));
      moyasar.getPaymentStatus.mockResolvedValue(providerPayment(40));
      moyasar.createRefund.mockResolvedValue(providerRefund(60));

      await handler.finalizeRefundFromCancellation({
        refundRequestId: 'refund-1', idempotencyKey: 'refund:refund-1',
      });

      expect(moyasar.createRefund).toHaveBeenCalledTimes(1);
      expect(moyasar.createRefund).toHaveBeenCalledWith(DEFAULT_ORG_ID, {
        paymentId: 'gateway-payment-1', amount: 20,
      });
      expect(prisma.refundRequest.updateMany).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          providerState: 'CALL_UNKNOWN',
          baselineRefundedAmount: 40,
          targetCumulativeRefundedAmount: 60,
        }),
      }));
      expect(prisma.payment.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ refundedAmount: { increment: 20 } }),
      }));
      expect(prisma.outboxEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          id: 'refund-1', eventType: 'finance.refund.completed',
        }),
      });
    });

    it.each([
      ['non-refundable provider status', providerPayment(40, { status: 'failed' })],
      ['provider/local partial-refund drift', providerPayment(20)],
      ['provider payment identity drift', providerPayment(40, { id: 'other-payment' })],
    ])('moves %s to MANUAL_REVIEW without POST', async (_case, provider) => {
      prisma.refundRequest.findUniqueOrThrow.mockResolvedValue(processing());
      prisma.payment.findUniqueOrThrow.mockResolvedValue(payment(40));
      moyasar.getPaymentStatus.mockResolvedValue(provider);

      await handler.finalizeRefundFromCancellation({
        refundRequestId: 'refund-1', idempotencyKey: 'refund:refund-1',
      });

      expect(moyasar.createRefund).not.toHaveBeenCalled();
      expect(prisma.refundRequest.updateMany).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          status: RefundStatus.MANUAL_REVIEW, providerState: 'MANUAL_REVIEW',
        }),
      }));
    });

    it('never POSTs twice after a network-unknown call; cumulative GET reaching target finalizes', async () => {
      const unknown = processing({
        providerState: 'CALL_UNKNOWN',
        baselineRefundedAmount: new Prisma.Decimal(40),
        targetCumulativeRefundedAmount: new Prisma.Decimal(60),
      });
      prisma.refundRequest.findUniqueOrThrow
        .mockResolvedValueOnce(processing()).mockResolvedValueOnce(processing())
        .mockResolvedValueOnce(unknown).mockResolvedValueOnce(unknown);
      prisma.payment.findUniqueOrThrow.mockResolvedValue(payment(40));
      moyasar.getPaymentStatus
        .mockResolvedValueOnce(providerPayment(40))
        .mockResolvedValueOnce(providerPayment(60));
      moyasar.createRefund.mockRejectedValueOnce(new Error('timeout after request write'));

      await expect(handler.finalizeRefundFromCancellation({
        refundRequestId: 'refund-1', idempotencyKey: 'refund:refund-1',
      })).rejects.toThrow('timeout');
      await handler.finalizeRefundFromCancellation({
        refundRequestId: 'refund-1', idempotencyKey: 'refund:refund-1',
      });

      expect(moyasar.createRefund).toHaveBeenCalledTimes(1);
      expect(moyasar.getPaymentStatus).toHaveBeenCalledTimes(2);
      expect(prisma.outboxEvent.create).not.toHaveBeenCalled();
      expect(prisma.refundRequest.updateMany).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ status: RefundStatus.MANUAL_REVIEW }),
      }));
    });

    it('moves an unknown call with unchanged cumulative amount to MANUAL_REVIEW without another POST', async () => {
      const unknown = processing({
        providerState: 'CALL_UNKNOWN',
        baselineRefundedAmount: new Prisma.Decimal(40),
        targetCumulativeRefundedAmount: new Prisma.Decimal(60),
      });
      prisma.refundRequest.findUniqueOrThrow.mockResolvedValue(unknown);
      prisma.payment.findUniqueOrThrow.mockResolvedValue(payment(40));
      moyasar.getPaymentStatus.mockResolvedValue(providerPayment(40));

      await handler.finalizeRefundFromCancellation({
        refundRequestId: 'refund-1', idempotencyKey: 'refund:refund-1',
      });

      expect(moyasar.createRefund).not.toHaveBeenCalled();
      expect(prisma.refundRequest.updateMany).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          status: RefundStatus.MANUAL_REVIEW,
          lastProviderError: expect.stringContaining('unchanged'),
        }),
      }));
    });

    it('recovers provider success followed by a crash before confirmed-state persistence using GET only', async () => {
      const unknown = processing({
        providerState: 'CALL_UNKNOWN',
        baselineRefundedAmount: new Prisma.Decimal(40),
        targetCumulativeRefundedAmount: new Prisma.Decimal(60),
      });
      prisma.refundRequest.findUniqueOrThrow
        .mockResolvedValueOnce(processing()).mockResolvedValueOnce(processing())
        .mockResolvedValueOnce(unknown).mockResolvedValueOnce(unknown);
      prisma.payment.findUniqueOrThrow.mockResolvedValue(payment(40));
      moyasar.getPaymentStatus
        .mockResolvedValueOnce(providerPayment(40))
        .mockResolvedValueOnce(providerPayment(60));
      let failConfirmedWrite = true;
      prisma.refundRequest.updateMany.mockImplementation(async ({ data }: any) => {
        if (data.providerState === 'CONFIRMED' && failConfirmedWrite) {
          failConfirmedWrite = false;
          throw new Error('connection lost after provider response');
        }
        return { count: 1 };
      });

      await expect(handler.finalizeRefundFromCancellation({
        refundRequestId: 'refund-1', idempotencyKey: 'refund:refund-1',
      })).rejects.toThrow('connection lost');
      await handler.finalizeRefundFromCancellation({
        refundRequestId: 'refund-1', idempotencyKey: 'refund:refund-1',
      });

      expect(moyasar.createRefund).toHaveBeenCalledTimes(1);
      expect(moyasar.getPaymentStatus).toHaveBeenCalledTimes(2);
      expect(prisma.outboxEvent.create).not.toHaveBeenCalled();
      expect(prisma.refundRequest.updateMany).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ status: RefundStatus.MANUAL_REVIEW }),
      }));
    });

    it('recovers a crash after durable provider confirmation without another provider call', async () => {
      const confirmed = processing({
        gatewayRef: 'gateway-payment-1', providerState: 'CONFIRMED',
        baselineRefundedAmount: new Prisma.Decimal(40),
        targetCumulativeRefundedAmount: new Prisma.Decimal(60),
        observedCumulativeRefundedAmount: new Prisma.Decimal(60),
      });
      prisma.refundRequest.findUniqueOrThrow
        .mockResolvedValueOnce(processing()).mockResolvedValueOnce(processing())
        .mockResolvedValueOnce(confirmed).mockResolvedValueOnce(confirmed);
      prisma.payment.findUniqueOrThrow.mockResolvedValue(payment(40));
      let failAccounting = true;
      prisma.$transaction.mockImplementation(async (work: (tx: typeof prisma) => Promise<unknown>) => {
        if (failAccounting) {
          failAccounting = false;
          throw new Error('accounting commit response lost');
        }
        return work(prisma);
      });

      await expect(handler.finalizeRefundFromCancellation({
        refundRequestId: 'refund-1', idempotencyKey: 'refund:refund-1',
      })).rejects.toThrow('accounting commit');
      await handler.finalizeRefundFromCancellation({
        refundRequestId: 'refund-1', idempotencyKey: 'refund:refund-1',
      });

      expect(moyasar.createRefund).toHaveBeenCalledTimes(1);
      expect(moyasar.getPaymentStatus).toHaveBeenCalledTimes(1);
      expect(prisma.outboxEvent.create).toHaveBeenCalledTimes(1);
    });

    it('serializes a consumer and reconciler so the CAS loser never reaches the provider', async () => {
      prisma.refundRequest.findUniqueOrThrow.mockResolvedValue(processing());
      prisma.payment.findUniqueOrThrow.mockResolvedValue(payment(40));
      let leaseAttempts = 0;
      prisma.refundRequest.updateMany.mockImplementation(async ({ data }: any) => {
        if (data.providerAttemptCount) return { count: leaseAttempts++ === 0 ? 1 : 0 };
        return { count: 1 };
      });
      let releaseGet!: () => void;
      const held = new Promise<void>((resolve) => { releaseGet = resolve; });
      moyasar.getPaymentStatus.mockImplementationOnce(async () => {
        await held;
        return providerPayment(40);
      });

      const winner = handler.finalizeRefundFromCancellation({
        refundRequestId: 'refund-1', idempotencyKey: 'refund:refund-1',
      });
      await Promise.resolve();
      await expect(handler.finalizeRefundFromCancellation({
        refundRequestId: 'refund-1', idempotencyKey: 'refund:refund-1',
      })).rejects.toThrow('lease');
      releaseGet();
      await winner;

      expect(moyasar.getPaymentStatus).toHaveBeenCalledTimes(1);
      expect(moyasar.createRefund).toHaveBeenCalledTimes(1);
    });

    it('blocks a distinct refund request at the payment provider fence before GET or POST', async () => {
      prisma.refundRequest.findUniqueOrThrow.mockResolvedValue(processing({ id: 'refund-2', idempotencyKey: 'refund:refund-2' }));
      prisma.payment.findUniqueOrThrow.mockResolvedValue(payment(40));
      prisma.payment.updateMany.mockResolvedValue({ count: 0 });
      await expect(handler.finalizeRefundFromCancellation({
        refundRequestId: 'refund-2', idempotencyKey: 'refund:refund-2',
      })).rejects.toThrow('Payment refund provider lease');
      expect(moyasar.getPaymentStatus).not.toHaveBeenCalled();
      expect(moyasar.createRefund).not.toHaveBeenCalled();
    });
  });

  describe('dashboard execute recovery', () => {
    it('acknowledges a source-event replay after completion without preflight or provider calls', async () => {
      prisma.refundRequest.findUnique.mockResolvedValue({
        id: 'refund-1', paymentId: 'payment-1', status: RefundStatus.COMPLETED,
        idempotencyKey: 'refund:refund-1',
      });
      prisma.payment.findUniqueOrThrow.mockResolvedValue({ id: 'payment-1', status: PaymentStatus.REFUNDED });

      await handler.execute({
        paymentId: 'payment-1', reason: 'cancel', sourceEventId: 'event-1',
      });

      expect(prisma.$queryRaw).not.toHaveBeenCalled();
      expect(moyasar.createRefund).not.toHaveBeenCalled();
    });

    it('persists the request under the payment lock then delegates to the same leased engine', async () => {
      prisma.$queryRaw.mockResolvedValue([{
        id: 'payment-1', status: PaymentStatus.COMPLETED, gatewayRef: 'gateway-payment-1',
        amount: new Prisma.Decimal(100), refundedAmount: new Prisma.Decimal(0), invoiceId: 'invoice-1',
      }]);
      prisma.invoice.findUniqueOrThrow.mockResolvedValue(invoice());
      prisma.payment.findUniqueOrThrow.mockResolvedValue({ id: 'payment-1', status: PaymentStatus.REFUNDED });
      const reconcile = jest.spyOn(handler, 'finalizeRefundFromCancellation').mockResolvedValue(undefined);

      await handler.execute({ paymentId: 'payment-1', reason: 'dashboard refund', amount: 20 });

      expect(prisma.refundRequest.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ providerState: 'BEFORE_CALL', status: RefundStatus.PROCESSING }),
      }));
      expect(reconcile).toHaveBeenCalledWith({
        refundRequestId: '11111111-1111-4111-8111-111111111111',
        idempotencyKey: 'refund:11111111-1111-4111-8111-111111111111',
      });
    });
  });
});
