import { BadRequestException, ConflictException, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PaymentStatus, Prisma, RefundStatus } from '@prisma/client';
import { DEFAULT_ORG_ID } from '../../../common/constants';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { EventBusService } from '../../../infrastructure/events';
import { MoyasarApiClient } from '../moyasar-api/moyasar-api.client';
import { stableEventId } from '../../../common/events';
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
        findUnique: jest.fn().mockResolvedValue({ invoiceId: 'invoice-1' }),
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

  it.each(['owned', 'legacy'])('locks invoice and payment before %s accounting mutates a request', async (path) => {
    prisma.refundRequest.findUniqueOrThrow.mockResolvedValue(processing());
    prisma.invoice.findUniqueOrThrow.mockResolvedValue(invoice({ total: new Prisma.Decimal(200), refundedAmount: new Prisma.Decimal(0) }));
    prisma.payment.findUniqueOrThrow.mockResolvedValue(payment(80));
    if (path === 'owned') await (handler as any).finalizeOwnedRefund({
      refundRequestId: 'refund-1', requestKey: 'refund:refund-1', leaseOwner: 'owner',
      providerPaymentId: 'gateway-payment-1', refundReq: processing(), refundAmount: 20,
    });
    else await handler.finalizeRefund('refund-1', 'refund:refund-1', 'gateway-payment-1');
    const sql = prisma.$queryRaw.mock.calls.map(([query]: any[]) =>
      (Array.isArray(query) ? query : query.strings).join(' '));
    expect(sql[0]).toMatch(/FROM "Invoice".*FOR UPDATE/s);
    expect(sql[1]).toMatch(/FROM "Payment".*FOR UPDATE/s);
    const mutation = path === 'owned' ? prisma.refundRequest.updateMany : prisma.refundRequest.update;
    expect(prisma.$queryRaw.mock.invocationCallOrder[1]).toBeLessThan(mutation.mock.invocationCallOrder[0]);
    expect(prisma.payment.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: PaymentStatus.REFUNDED }),
    }));
    expect(prisma.invoice.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'PARTIALLY_REFUNDED', refundedAmount: 20 }),
    }));
  });

  it('does not apply a completed legacy refund twice after taking its accounting locks', async () => {
    prisma.refundRequest.findUniqueOrThrow.mockResolvedValue(processing({ status: RefundStatus.COMPLETED }));
    await handler.finalizeRefund('refund-1', 'refund:refund-1', 'gateway-payment-1');
    expect(prisma.refundRequest.update).not.toHaveBeenCalled();
    expect(prisma.payment.update).not.toHaveBeenCalled();
    expect(prisma.invoice.update).not.toHaveBeenCalled();
  });

  it('keeps a fully refunded cancellation payment independent of the invoice balance', async () => {
    prisma.$queryRaw.mockResolvedValue([{
      id: 'payment-1', invoiceId: 'invoice-1', status: PaymentStatus.COMPLETED,
      method: 'CASH', gatewayRef: null, amount: new Prisma.Decimal(100), refundedAmount: new Prisma.Decimal(0),
    }]);
    prisma.invoice.findUniqueOrThrow.mockResolvedValue(invoice({ total: new Prisma.Decimal(200), refundedAmount: new Prisma.Decimal(0) }));
    await handler.createRefundRequestInTx(prisma, { paymentId: 'payment-1', reason: 'cancelled', amount: 100 });
    expect(prisma.payment.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: PaymentStatus.REFUNDED }) }));
  });

  describe('unsupported repeated Moyasar refunds', () => {
    it.each([
      ['dashboard', PaymentStatus.PARTIALLY_REFUNDED, 400],
      ['dashboard', PaymentStatus.COMPLETED, 400],
      ['dashboard', PaymentStatus.PARTIALLY_REFUNDED, 0],
      ['cancellation', PaymentStatus.PARTIALLY_REFUNDED, 400],
      ['cancellation', PaymentStatus.COMPLETED, 400],
      ['cancellation', PaymentStatus.PARTIALLY_REFUNDED, 0],
    ])('rejects %s card refund from %s with refunded=%i before creating a request', async (path, status, refunded) => {
      const row = {
        id: 'payment-1', method: 'ONLINE_CARD', status, gatewayRef: 'gateway-payment-1',
        amount: new Prisma.Decimal(1000), refundedAmount: new Prisma.Decimal(refunded), invoiceId: 'invoice-1',
      };
      prisma.$queryRaw.mockResolvedValue([row]);
      prisma.invoice.findUniqueOrThrow.mockResolvedValue(invoice({
        total: new Prisma.Decimal(1000), vatAmt: new Prisma.Decimal(0), refundedAmount: new Prisma.Decimal(refunded),
      }));
      const finalize = jest.spyOn(handler, 'finalizeRefundFromCancellation').mockResolvedValue(undefined);
      const cmd = { paymentId: 'payment-1', reason: 'remaining refund', amount: 600 };
      const action = path === 'dashboard'
        ? handler.execute(cmd)
        : handler.createRefundRequestInTx(prisma, cmd);

      await expect(action).rejects.toThrow('Moyasar does not support a second gateway refund');
      await expect(action).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.refundRequest.create).not.toHaveBeenCalled();
      expect(finalize).not.toHaveBeenCalled();
      expect(moyasar.getPaymentStatus).not.toHaveBeenCalled();
      expect(moyasar.createRefund).not.toHaveBeenCalled();
      expect(prisma.payment.update).not.toHaveBeenCalled();
      expect(prisma.invoice.update).not.toHaveBeenCalled();
      expect(prisma.outboxEvent.create).not.toHaveBeenCalled();
    });

    it.each(['CASH', 'BANK_TRANSFER'])('keeps repeated off-gateway %s cancellation refunds supported', async (method) => {
      prisma.$queryRaw.mockResolvedValue([{
        id: 'payment-1', method, status: PaymentStatus.PARTIALLY_REFUNDED, gatewayRef: null,
        amount: new Prisma.Decimal(1000), refundedAmount: new Prisma.Decimal(400), invoiceId: 'invoice-1',
      }]);
      prisma.invoice.findUniqueOrThrow.mockResolvedValue(invoice({
        total: new Prisma.Decimal(1000), vatAmt: new Prisma.Decimal(0), refundedAmount: new Prisma.Decimal(400),
      }));

      const result = await handler.createRefundRequestInTx(prisma, {
        paymentId: 'payment-1', reason: 'remaining cash refund', amount: 600,
      });

      expect(result.payment.gatewayRef).toBeNull();
      expect(prisma.refundRequest.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ status: RefundStatus.COMPLETED, amount: 600 }),
      }));
      expect(prisma.payment.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ status: PaymentStatus.REFUNDED, refundedAmount: { increment: 600 } }),
      }));
      expect(prisma.invoice.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ status: 'REFUNDED', refundedAmount: 1000 }),
      }));
      expect(moyasar.createRefund).not.toHaveBeenCalled();
    });
  });

  describe('createRefundRequestInTx', () => {
    const rawPayment = (overrides: Record<string, unknown> = {}) => ({
      id: 'payment-1', status: PaymentStatus.COMPLETED, gatewayRef: 'gateway-payment-1',
      amount: new Prisma.Decimal(100), refundedAmount: new Prisma.Decimal(0),
      invoiceId: 'invoice-1', ...overrides,
    });

    it('rejects missing, non-refundable, in-flight and over-refund requests under the payment lock', async () => {
      prisma.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
      await expect(handler.createRefundRequestInTx(prisma, {
        paymentId: 'missing', reason: 'cancel',
      })).rejects.toThrow(NotFoundException);

      prisma.$queryRaw
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([rawPayment({ status: PaymentStatus.PENDING })]);
      await expect(handler.createRefundRequestInTx(prisma, {
        paymentId: 'payment-1', reason: 'cancel',
      })).rejects.toThrow(BadRequestException);

      prisma.$queryRaw
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([rawPayment()]);
      prisma.refundRequest.findFirst.mockResolvedValueOnce({ id: 'in-flight' });
      await expect(handler.createRefundRequestInTx(prisma, {
        paymentId: 'payment-1', reason: 'cancel',
      })).rejects.toThrow('already processing');

      prisma.$queryRaw
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([rawPayment({ refundedAmount: new Prisma.Decimal(80) })]);
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

  describe('provider preflight lookup failure', () => {
    it.each(['BEFORE_CALL', 'NOT_CALLED'])('makes an authoritative 404 in %s terminal and replay-safe without refunding', async providerState => {
      const cancellationEventId = '22222222-2222-4222-8222-222222222222';
      const current = processing({
        providerState, sourceEventId: stableEventId(`${cancellationEventId}:payment:payment-1`),
        clientId: 'client-1', invoice: invoice(),
      });
      prisma.refundRequest.findUniqueOrThrow.mockImplementation(async () => ({ ...current }));
      prisma.refundRequest.updateMany.mockImplementation(async ({ where, data }: any) => {
        if ((where.status && where.status !== current.status)
          || (where.providerLeaseOwner && where.providerLeaseOwner !== current.providerLeaseOwner)) {
          return { count: 0 };
        }
        Object.assign(current, data);
        return { count: 1 };
      });
      prisma.bookingStatusLog = { findFirst: jest.fn().mockResolvedValue({ sourceActionResult: { cancellationEventId } }) };
      prisma.outboxEvent.findUnique = jest.fn().mockResolvedValue({ payload: { payload: {
        clientCancellation: { version: 1, initiatedBy: 'CLIENT', allocations: [{ paymentId: 'payment-1' }] },
      } } });
      prisma.outboxEvent.upsert = jest.fn();
      const missing = new NotFoundException('Moyasar API error: payment missing (status: 404)');
      moyasar.getPaymentStatus.mockRejectedValue(missing);
      const command = { refundRequestId: 'refund-1', idempotencyKey: 'refund:refund-1' };

      await expect(handler.finalizeRefundFromCancellation(command)).rejects.toBe(missing);

      expect(current).toEqual(expect.objectContaining({
        status: RefundStatus.FAILED, providerState: 'FAILED',
        providerLeaseOwner: null, providerLeaseExpiresAt: null,
        lastProviderError: expect.any(String),
      }));
      expect(prisma.refundRequest.updateMany).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'refund-1', status: RefundStatus.PROCESSING, providerLeaseOwner: '11111111-1111-4111-8111-111111111111' },
        data: expect.objectContaining({ status: RefundStatus.FAILED, providerState: 'FAILED' }),
      }));
      expect(prisma.payment.updateMany).toHaveBeenLastCalledWith({
        where: { id: 'payment-1', refundProviderLeaseOwner: '11111111-1111-4111-8111-111111111111' },
        data: { refundProviderLeaseOwner: null, refundProviderLeaseExpiresAt: null },
      });
      await expect(handler.finalizeRefundFromCancellation(command)).resolves.toBeUndefined();
      expect(moyasar.getPaymentStatus).toHaveBeenCalledTimes(1);
      expect(moyasar.createRefund).not.toHaveBeenCalled();
      expect(prisma.payment.update).not.toHaveBeenCalled();
      expect(prisma.invoice.update).not.toHaveBeenCalled();
      expect(prisma.outboxEvent.create).not.toHaveBeenCalled();
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.outboxEvent.upsert).toHaveBeenCalledTimes(1);
      expect(prisma.outboxEvent.upsert).toHaveBeenCalledWith(expect.objectContaining({
        create: expect.objectContaining({
          eventType: 'finance.cancellation-refund.updated',
          payload: expect.objectContaining({ payload: expect.objectContaining({
            status: 'FAILED', refundRequestId: 'refund-1', amount: 20,
          }) }),
        }),
      }));
    });

    it.each([
      ['network', new Error('network unavailable')],
      ['500', new InternalServerErrorException('Moyasar API error (status: 500)')],
      ['403', new InternalServerErrorException('Moyasar API error (status: 403)')],
      ['untyped 404', Object.assign(new Error('404'), { status: 404 })],
    ])('keeps a %s preflight error retryable without refunding', async (_case, error) => {
      const current = processing();
      prisma.refundRequest.findUniqueOrThrow.mockImplementation(async () => ({ ...current }));
      prisma.refundRequest.updateMany.mockImplementation(async ({ data }: any) => {
        Object.assign(current, data);
        return { count: 1 };
      });
      moyasar.getPaymentStatus.mockRejectedValue(error);
      const command = { refundRequestId: 'refund-1', idempotencyKey: 'refund:refund-1' };

      await expect(handler.finalizeRefundFromCancellation(command)).rejects.toBe(error);
      await expect(handler.finalizeRefundFromCancellation(command)).rejects.toBe(error);

      expect(current).toEqual(expect.objectContaining({
        status: RefundStatus.PROCESSING, providerState: 'BEFORE_CALL',
        providerLeaseOwner: null, providerLeaseExpiresAt: null,
      }));
      expect(moyasar.getPaymentStatus).toHaveBeenCalledTimes(2);
      expect(moyasar.createRefund).not.toHaveBeenCalled();
      expect(prisma.payment.update).not.toHaveBeenCalled();
      expect(prisma.invoice.update).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('does not classify a reconciliation 404 after an unknown POST as a definitive failed refund', async () => {
      const current = processing({
        providerState: 'CALL_UNKNOWN', baselineRefundedAmount: new Prisma.Decimal(40),
        targetCumulativeRefundedAmount: new Prisma.Decimal(60),
      });
      prisma.refundRequest.findUniqueOrThrow.mockImplementation(async () => ({ ...current }));
      prisma.refundRequest.updateMany.mockImplementation(async ({ data }: any) => {
        Object.assign(current, data);
        return { count: 1 };
      });
      moyasar.getPaymentStatus.mockRejectedValue(new NotFoundException('provider missing'));

      await expect(handler.finalizeRefundFromCancellation({
        refundRequestId: 'refund-1', idempotencyKey: 'refund:refund-1',
      })).rejects.toThrow(NotFoundException);

      expect(current).toEqual(expect.objectContaining({
        status: RefundStatus.PROCESSING, providerState: 'CALL_UNKNOWN',
        providerLeaseOwner: null, providerLeaseExpiresAt: null,
      }));
      expect(moyasar.createRefund).not.toHaveBeenCalled();
      expect(prisma.payment.update).not.toHaveBeenCalled();
      expect(prisma.invoice.update).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('official cumulative-refund reconciliation', () => {
    it.each(['FAILED', 'MANUAL_REVIEW'])('atomically captures later cancellation %s and uses a stable event identity on replay', async status => {
      const cancellationEventId = '22222222-2222-4222-8222-222222222222';
      const current = processing({ sourceEventId: stableEventId(`${cancellationEventId}:payment:payment-1`), clientId: 'client-1', invoice: invoice() });
      prisma.refundRequest.findUniqueOrThrow.mockImplementation(async () => ({ ...current }));
      prisma.refundRequest.updateMany.mockImplementation(async ({ data }: any) => { Object.assign(current, data); return { count: 1 }; });
      prisma.bookingStatusLog = { findFirst: jest.fn().mockResolvedValue({ sourceActionResult: { cancellationEventId, refund: { refundAmount: 20 } } }) };
      prisma.outboxEvent.findUnique = jest.fn().mockResolvedValue({ payload: { payload: { clientCancellation: { version: 1, initiatedBy: 'CLIENT', allocations: [{ paymentId: 'payment-1' }] } } } });
      prisma.outboxEvent.upsert = jest.fn();
      if (status === 'FAILED') moyasar.createRefund.mockRejectedValue(new NotFoundException('provider missing'));
      else moyasar.getPaymentStatus.mockResolvedValue(providerPayment(30));
      const command = { refundRequestId: 'refund-1', idempotencyKey: 'refund:refund-1' };
      if (status === 'FAILED') await expect(handler.finalizeRefundFromCancellation(command)).rejects.toThrow('provider missing');
      else await handler.finalizeRefundFromCancellation(command);
      await handler.finalizeRefundFromCancellation(command);
      expect(prisma.outboxEvent.upsert).toHaveBeenCalledTimes(1);
      expect(prisma.outboxEvent.upsert).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: stableEventId(`${cancellationEventId}:refund:refund-1:${status}`) },
        create: expect.objectContaining({ eventType: 'finance.cancellation-refund.updated', payload: expect.objectContaining({ payload: expect.objectContaining({ status, amount: 20, refundRequestId: 'refund-1' }) }) }),
      }));
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.payment.update).not.toHaveBeenCalled();
    });

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
      [400, 400, PaymentStatus.PARTIALLY_REFUNDED],
      [1000, 1000, PaymentStatus.REFUNDED],
    ])('keeps the first gateway refund of %i halalas supported', async (amount, target, status) => {
      prisma.refundRequest.findUniqueOrThrow.mockResolvedValue(processing({ amount: new Prisma.Decimal(amount) }));
      prisma.payment.findUniqueOrThrow.mockResolvedValue(payment(0, { amount: new Prisma.Decimal(1000) }));
      prisma.invoice.findUniqueOrThrow.mockResolvedValue(invoice({
        total: new Prisma.Decimal(1000), vatAmt: new Prisma.Decimal(0), refundedAmount: new Prisma.Decimal(0),
      }));
      moyasar.getPaymentStatus.mockResolvedValue(providerPayment(0, { amount: 1000 }));
      moyasar.createRefund.mockResolvedValue(providerRefund(target, { amount }));

      await handler.finalizeRefundFromCancellation({ refundRequestId: 'refund-1', idempotencyKey: 'refund:refund-1' });

      expect(moyasar.createRefund).toHaveBeenCalledTimes(1);
      expect(moyasar.createRefund).toHaveBeenCalledWith(DEFAULT_ORG_ID, { paymentId: 'gateway-payment-1', amount });
      const baselineWrite = prisma.refundRequest.updateMany.mock.calls.findIndex(([update]: [any]) =>
        update.data.providerState === 'CALL_UNKNOWN'
        && update.data.baselineRefundedAmount === 0
        && update.data.targetCumulativeRefundedAmount === target);
      expect(baselineWrite).toBeGreaterThanOrEqual(0);
      expect(prisma.refundRequest.updateMany.mock.invocationCallOrder[baselineWrite])
        .toBeLessThan(moyasar.createRefund.mock.invocationCallOrder[0]);
      expect(prisma.refundRequest.updateMany).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ status: RefundStatus.COMPLETED, providerState: 'CONFIRMED' }),
      }));
      expect(prisma.payment.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ status, refundedAmount: { increment: amount } }),
      }));
      expect(prisma.invoice.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ status, refundedAmount: target, refundedVatAmt: 0 }),
      }));
      expect(prisma.outboxEvent.create).toHaveBeenCalledTimes(1);
      expect(prisma.payment.updateMany).toHaveBeenLastCalledWith(expect.objectContaining({
        data: { refundProviderLeaseOwner: null, refundProviderLeaseExpiresAt: null },
      }));
    });

    it.each([
      ['already refunded provider payment', {}, 400, 600],
      ['zero refunded baseline', { refunded: 0 }, 0, 600],
      ['fully refunded payment', { refunded: 1000 }, 1000, 1],
      ['refund above original amount', { refunded: 1001 }, 1001, 1],
      ['negative refunded baseline', { refunded: -1 }, -1, 600],
      ['provider/local baseline drift', { refunded: 300 }, 400, 600],
      ['currency drift', { currency: 'USD' }, 400, 600],
      ['identity drift', { id: 'other-payment' }, 400, 600],
      ['original amount drift', { amount: 1100 }, 400, 600],
      ['request above remaining balance', {}, 400, 601],
      ['zero refund request', {}, 400, 0],
      ['failed payment', { status: 'failed' }, 400, 600],
      ['voided payment', { status: 'voided' }, 400, 600],
      ['authorized payment', { status: 'authorized' }, 400, 600],
      ['initiated payment', { status: 'initiated' }, 400, 600],
    ])('keeps %s in MANUAL_REVIEW without POST or accounting', async (_case, overrides, localRefunded, amount) => {
      prisma.refundRequest.findUniqueOrThrow.mockResolvedValue(processing({ amount: new Prisma.Decimal(amount) }));
      prisma.payment.findUniqueOrThrow.mockResolvedValue(payment(localRefunded, { amount: new Prisma.Decimal(1000) }));
      moyasar.getPaymentStatus.mockResolvedValue(providerPayment(400, { status: 'refunded', amount: 1000, ...overrides }));

      await handler.finalizeRefundFromCancellation({ refundRequestId: 'refund-1', idempotencyKey: 'refund:refund-1' });

      expect(moyasar.createRefund).not.toHaveBeenCalled();
      expect(prisma.payment.update).not.toHaveBeenCalled();
      expect(prisma.invoice.update).not.toHaveBeenCalled();
      expect(prisma.outboxEvent.create).not.toHaveBeenCalled();
      expect(prisma.refundRequest.updateMany).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ status: RefundStatus.MANUAL_REVIEW, providerState: 'MANUAL_REVIEW' }),
      }));
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

    it('moves a provider response above this request target to MANUAL_REVIEW without accounting', async () => {
      prisma.refundRequest.findUniqueOrThrow.mockResolvedValue(processing());
      prisma.payment.findUniqueOrThrow.mockResolvedValue(payment(40));
      moyasar.createRefund.mockResolvedValue(providerRefund(80));
      await handler.finalizeRefundFromCancellation({ refundRequestId: 'refund-1', idempotencyKey: 'refund:refund-1' });
      expect(prisma.outboxEvent.create).not.toHaveBeenCalled();
      expect(prisma.refundRequest.updateMany).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ status: RefundStatus.MANUAL_REVIEW }),
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
        .mockResolvedValueOnce(unknown).mockResolvedValueOnce(unknown)
        .mockResolvedValueOnce(processing({ status: RefundStatus.MANUAL_REVIEW }));
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
        .mockResolvedValueOnce(unknown).mockResolvedValueOnce(unknown)
        .mockResolvedValueOnce(processing({ status: RefundStatus.MANUAL_REVIEW }));
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
