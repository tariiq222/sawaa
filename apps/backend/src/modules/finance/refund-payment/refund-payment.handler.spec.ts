import { Test } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { PaymentStatus, Prisma, RefundStatus } from '@prisma/client';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { EventBusService } from '../../../infrastructure/events';
import { RefundCompletedEvent } from '../events/refund-completed.event';
import { MoyasarApiClient } from '../moyasar-api/moyasar-api.client';
import { RefundPaymentHandler } from './refund-payment.handler';
import { DEFAULT_ORG_ID } from '../../../common/constants';
import * as RequestContextModule from '../../../common/http/request-context';

jest.mock('node:crypto', () => ({
  ...jest.requireActual('node:crypto'),
  randomUUID: jest.fn().mockReturnValue('test-uuid-1234'),
}));

describe('RefundPaymentHandler', () => {
  let handler: RefundPaymentHandler;

  const prisma: Record<string, any> = {
    $transaction: jest.fn(),
    refundRequest: {
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    payment: {
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
    },
    invoice: {
      findUniqueOrThrow: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    outboxEvent: { create: jest.fn() },
    $queryRaw: jest.fn(),
  };
  prisma.$transaction = jest.fn(async (cb: (tx: unknown) => Promise<unknown>) => await cb(prisma));

  const moyasar = { createRefund: jest.fn() };
  const eventBus = { publish: jest.fn().mockResolvedValue(undefined) };

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.refundRequest.update.mockReset().mockResolvedValue({});
    prisma.refundRequest.updateMany.mockReset().mockResolvedValue({ count: 1 });
    prisma.refundRequest.findUnique.mockReset().mockResolvedValue(null);
    prisma.outboxEvent.create.mockReset().mockResolvedValue({});
    eventBus.publish.mockReset().mockResolvedValue(undefined);
    moyasar.createRefund.mockReset();
    jest.spyOn(RequestContextModule.RequestContextStorage, 'get').mockReturnValue(undefined);

    const module = await Test.createTestingModule({
      providers: [
        RefundPaymentHandler,
        { provide: PrismaService, useValue: prisma },
        { provide: RlsTransactionService, useValue: { withTransaction: (fn: (tx: unknown) => Promise<unknown>) => prisma.$transaction(fn), withBypassTransaction: (fn: (tx: unknown) => Promise<unknown>) => prisma.$transaction(fn) } },
        { provide: EventBusService, useValue: eventBus },
        { provide: MoyasarApiClient, useValue: moyasar },
      ],
    }).compile();

    handler = module.get(RefundPaymentHandler);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ── Helpers ───────────────────────────────────────────────────────────────

  const makePaymentRow = (overrides?: Partial<{ id: string; status: string; gatewayRef: string | null; amount: number; refundedAmount: number; invoiceId: string }>) => [
    {
      id: 'pay-1',
      status: PaymentStatus.COMPLETED,
      gatewayRef: 'gateway-ref-1',
      amount: 100,
      refundedAmount: 0,
      invoiceId: 'inv-1',
      ...overrides,
    },
  ];

  const makeInvoice = (overrides?: Partial<{ id: string; bookingId: string; clientId: string; currency: string; total: number; vatAmt: number; refundedAmount: number }>) => ({
    id: 'inv-1',
    bookingId: 'book-1',
    clientId: 'client-1',
    currency: 'SAR',
    total: 100,
    vatAmt: 15,
    refundedAmount: 0,
    ...overrides,
  });

  // ── getRefundRequest ──────────────────────────────────────────────────────

  describe('getRefundRequest', () => {
    it('returns a refund request when found', async () => {
      const refundReq = {
        id: 'rr-1',
        paymentId: 'pay-1',
        amount: 100,
        status: RefundStatus.PROCESSING,
        gatewayRef: null,
      };
      prisma.refundRequest.findUnique.mockResolvedValue(refundReq);

      const result = await handler.getRefundRequest({ id: 'rr-1' });

      expect(result).toEqual(refundReq);
      expect(prisma.refundRequest.findUnique).toHaveBeenCalledWith({
        where: { id: 'rr-1' },
        select: { id: true, paymentId: true, amount: true, status: true, gatewayRef: true },
      });
    });

    it('returns null when not found', async () => {
      prisma.refundRequest.findUnique.mockResolvedValue(null);

      const result = await handler.getRefundRequest({ id: 'rr-1' });

      expect(result).toBeNull();
    });

    it('converts a Prisma.Decimal amount to an integer number at the boundary', async () => {
      // The Decimal(12,2) column surfaces as Prisma.Decimal; the handler must
      // hand back a plain integer-halala number, not a Decimal object.
      prisma.refundRequest.findUnique.mockResolvedValue({
        id: 'rr-1',
        paymentId: 'pay-1',
        amount: new Prisma.Decimal('12345'),
        status: RefundStatus.PROCESSING,
        gatewayRef: null,
      });

      const result = await handler.getRefundRequest({ id: 'rr-1' });

      expect(result?.amount).toBe(12345);
      expect(typeof result?.amount).toBe('number');
    });
  });

  // ── callMoyasarAndFinalize ────────────────────────────────────────────────

  describe('callMoyasarAndFinalize', () => {
    it('delegates to moyasar.createRefund with the amount verbatim (already halalas)', async () => {
      moyasar.createRefund.mockResolvedValue({ id: 'moy-ref-1' });

      const result = await handler.callMoyasarAndFinalize('gateway-ref-1', 15055, 'idemp-1', 'org-1');

      expect(result).toEqual({ id: 'moy-ref-1' });
      expect(moyasar.createRefund).toHaveBeenCalledWith('org-1', {
        paymentId: 'gateway-ref-1',
        amount: 15055,
        idempotencyKey: 'idemp-1',
      });
    });

    it('refunds a 12000-halala payment in full without multiplying by 100', async () => {
      moyasar.createRefund.mockResolvedValue({ id: 'moy-ref-2' });

      await handler.callMoyasarAndFinalize('gateway-ref-1', 12000, 'idemp-2', 'org-1');

      const params = moyasar.createRefund.mock.calls[0][1];
      expect(params.amount).toBe(12000);
      expect(params.amount).not.toBe(1200000);
    });
  });

  // ── finalizeRefund ────────────────────────────────────────────────────────

  describe('finalizeRefund', () => {
    it('updates refundRequest, payment and invoice in a transaction', async () => {
      prisma.refundRequest.findUniqueOrThrow.mockResolvedValue({
        paymentId: 'pay-1',
        amount: 100,
        invoiceId: 'inv-1',
      });
      prisma.invoice.findUniqueOrThrow.mockResolvedValue(makeInvoice());

      await handler.finalizeRefund('rr-1', 'idemp-1', 'moy-ref-1');

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.refundRequest.update).toHaveBeenCalledWith({
        where: { id: 'rr-1' },
        data: { status: RefundStatus.COMPLETED, gatewayRef: 'moy-ref-1' },
      });
      expect(prisma.payment.update).toHaveBeenCalledWith({
        where: { id: 'pay-1' },
        data: {
          status: PaymentStatus.REFUNDED,
          failureReason: 'Booking cancellation refund (idemp-1)',
          refundedAmount: { increment: 100 },
        },
      });
      expect(prisma.invoice.update).toHaveBeenCalledWith({
        where: { id: 'inv-1' },
        data: expect.objectContaining({
          status: 'REFUNDED',
          refundedAmount: expect.any(Number),
          refundedVatAmt: expect.any(Number),
        }),
      });
    });

    it('R-08: sets Payment to PARTIALLY_REFUNDED when the invoice is only partly refunded', async () => {
      prisma.refundRequest.findUniqueOrThrow.mockResolvedValue({
        paymentId: 'pay-1', amount: 40, invoiceId: 'inv-1',
      });
      // total 100, only 40 refunded → invoice + payment PARTIALLY_REFUNDED.
      prisma.invoice.findUniqueOrThrow.mockResolvedValue(
        makeInvoice({ total: 100, vatAmt: 15, refundedAmount: 0 }),
      );

      await handler.finalizeRefund('rr-1', 'idemp-1', 'moy-ref-1');

      expect(prisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'pay-1' },
          data: expect.objectContaining({ status: PaymentStatus.PARTIALLY_REFUNDED }),
        }),
      );
      expect(prisma.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'PARTIALLY_REFUNDED' }) }),
      );
    });
  });

  // ── createRefundRequestInTx ───────────────────────────────────────────────

  describe('createRefundRequestInTx', () => {
    it('throws NotFoundException when payment row is missing', async () => {
      prisma.$queryRaw.mockResolvedValue([]);

      await expect(
        handler.createRefundRequestInTx(prisma as any, { paymentId: 'pay-1', reason: 'test' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when payment is not COMPLETED', async () => {
      prisma.$queryRaw.mockResolvedValue(makePaymentRow({ status: PaymentStatus.PENDING }));

      await expect(
        handler.createRefundRequestInTx(prisma as any, { paymentId: 'pay-1', reason: 'test' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('P1-1: settles an off-gateway (no gatewayRef) refund fully in-tx as COMPLETED', async () => {
      // Off-gateway (cash/bank-transfer) payment: no gatewayRef. The cancellation
      // transaction must NOT abort — instead the refund is born COMPLETED and the
      // payment + invoice are updated inside this same tx, with no Moyasar call.
      prisma.$queryRaw.mockResolvedValue(makePaymentRow({ gatewayRef: null }));
      prisma.refundRequest.findFirst.mockResolvedValue(null);
      prisma.invoice.findUniqueOrThrow.mockResolvedValue(makeInvoice({ total: 100, vatAmt: 0, refundedAmount: 0 }));
      prisma.refundRequest.create.mockResolvedValue({ id: 'rr-new' });
      prisma.payment.update.mockResolvedValue({ id: 'pay-1', status: RefundStatus.COMPLETED });
      prisma.invoice.update.mockResolvedValue({ id: 'inv-1' });

      const result = await handler.createRefundRequestInTx(prisma as any, {
        paymentId: 'pay-1',
        reason: 'off-gateway cancel',
        performedBy: 'admin-1',
      });

      expect(result.refundRequestId).toBe('test-uuid-1234');
      expect(result.idempotencyKey).toBe('refund:test-uuid-1234');
      expect(result.payment.gatewayRef).toBeNull();
      // Born COMPLETED — the downstream finalize step sees it done and skips Moyasar.
      expect(prisma.refundRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: RefundStatus.COMPLETED }),
        }),
      );
      // Payment + invoice settled in the same tx; no external gateway call here.
      expect(prisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'pay-1' },
          data: expect.objectContaining({
            status: PaymentStatus.REFUNDED,
            refundedAmount: { increment: 100 },
          }),
        }),
      );
      expect(prisma.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'inv-1' },
          data: expect.objectContaining({ status: 'REFUNDED' }),
        }),
      );
      expect(moyasar.createRefund).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when an in-flight refund already exists', async () => {
      prisma.$queryRaw.mockResolvedValue(makePaymentRow());
      prisma.refundRequest.findFirst.mockResolvedValue({ id: 'rr-existing' });

      await expect(
        handler.createRefundRequestInTx(prisma as any, { paymentId: 'pay-1', reason: 'test' }),
      ).rejects.toThrow('Payment refund is already processing');
    });

    it('returns refundRequestId, idempotencyKey and payment on success', async () => {
      prisma.$queryRaw.mockResolvedValue(makePaymentRow());
      prisma.refundRequest.findFirst.mockResolvedValue(null);
      prisma.invoice.findUniqueOrThrow.mockResolvedValue(makeInvoice());
      prisma.refundRequest.create.mockResolvedValue({ id: 'rr-new' });

      const result = await handler.createRefundRequestInTx(prisma as any, {
        paymentId: 'pay-1',
        reason: 'customer request',
        performedBy: 'admin-1',
      });

      expect(result.refundRequestId).toBe('test-uuid-1234');
      // P1: idempotency key now keyed on refundRequestId (collision-free).
      expect(result.idempotencyKey).toBe('refund:test-uuid-1234');
      expect(result.payment.id).toBe('pay-1');
      expect(result.payment.gatewayRef).toBe('gateway-ref-1');
      expect(prisma.refundRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            id: 'test-uuid-1234',
            invoiceId: 'inv-1',
            paymentId: 'pay-1',
            clientId: 'client-1',
            amount: 100,
            reason: 'customer request',
            status: RefundStatus.PROCESSING,
            processedBy: 'admin-1',
          }),
          select: { id: true },
        }),
      );
    });

    it('converts Decimal amount/refundedAmount from the raw row to integer halalas', async () => {
      // $queryRaw surfaces the Decimal(12,2) columns as Prisma.Decimal — the
      // handler must convert once at the boundary and return plain numbers.
      prisma.$queryRaw.mockResolvedValue(
        makePaymentRow({
          amount: new Prisma.Decimal('10000') as never,
          refundedAmount: new Prisma.Decimal('4000') as never,
        }),
      );
      prisma.refundRequest.findFirst.mockResolvedValue(null);
      prisma.invoice.findUniqueOrThrow.mockResolvedValue(makeInvoice());
      prisma.refundRequest.create.mockResolvedValue({ id: 'rr-new' });

      const result = await handler.createRefundRequestInTx(prisma as any, {
        paymentId: 'pay-1',
        reason: 'partial after decimal',
        amount: 6000, // exactly the outstanding balance (10000 − 4000)
      });

      expect(result.payment.amount).toBe(10000);
      expect(typeof result.payment.amount).toBe('number');
      expect(prisma.refundRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ amount: 6000 }),
        }),
      );
    });
  });

  // ── finalizeRefundFromCancellation ────────────────────────────────────────

  describe('finalizeRefundFromCancellation', () => {
    it('skips when refund request is already COMPLETED', async () => {
      prisma.refundRequest.findUniqueOrThrow.mockResolvedValue({
        id: 'rr-1',
        paymentId: 'pay-1',
        amount: 100,
        invoiceId: 'inv-1',
        status: RefundStatus.COMPLETED,
      });

      await handler.finalizeRefundFromCancellation({ refundRequestId: 'rr-1', idempotencyKey: 'idemp-1' });

      expect(moyasar.createRefund).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(eventBus.publish).not.toHaveBeenCalled();
    });

    it('calls Moyasar, records confirmation, finalizes accounting, and writes the completion outbox in one tx', async () => {
      prisma.refundRequest.findUniqueOrThrow.mockResolvedValue({
        id: 'rr-1',
        paymentId: 'pay-1',
        amount: 100,
        invoiceId: 'inv-1',
        status: RefundStatus.PROCESSING,
      });
      prisma.payment.findUniqueOrThrow.mockResolvedValue({ id: 'pay-1', gatewayRef: 'gateway-ref-1' });
      moyasar.createRefund.mockResolvedValue({ id: 'moy-ref-1' });
      prisma.refundRequest.updateMany.mockResolvedValue({ count: 1 });
      prisma.invoice.findUniqueOrThrow.mockResolvedValue(makeInvoice());
      prisma.invoice.findUnique.mockResolvedValue(makeInvoice());

      await handler.finalizeRefundFromCancellation({ refundRequestId: 'rr-1', idempotencyKey: 'idemp-1' });

      expect(moyasar.createRefund).toHaveBeenCalledWith(DEFAULT_ORG_ID, {
        paymentId: 'gateway-ref-1',
        amount: 100,
        idempotencyKey: 'idemp-1',
      });
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.refundRequest.updateMany).toHaveBeenCalledWith({
        where: { id: 'rr-1', status: RefundStatus.PROCESSING },
        data: expect.objectContaining({
          status: RefundStatus.COMPLETED,
          gatewayRef: 'moy-ref-1',
          providerState: 'CONFIRMED',
        }),
      });
      expect(prisma.outboxEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          id: 'rr-1',
          aggregateId: 'rr-1',
          eventType: 'finance.refund.completed',
          payload: expect.objectContaining({
            eventId: 'rr-1',
            payload: expect.objectContaining({ refundRequestId: 'rr-1', amount: 100 }),
          }),
        }),
      });
      expect(eventBus.publish).not.toHaveBeenCalled();
    });

    it('sends an integer halala amount to Moyasar when the DB yields a Decimal', async () => {
      prisma.refundRequest.findUniqueOrThrow.mockResolvedValue({
        id: 'rr-1',
        paymentId: 'pay-1',
        amount: new Prisma.Decimal('15055'),
        invoiceId: 'inv-1',
        status: RefundStatus.PROCESSING,
      });
      prisma.payment.findUniqueOrThrow.mockResolvedValue({ id: 'pay-1', gatewayRef: 'gateway-ref-1' });
      moyasar.createRefund.mockResolvedValue({ id: 'moy-ref-1' });
      prisma.refundRequest.updateMany.mockResolvedValue({ count: 1 });
      prisma.invoice.findUniqueOrThrow.mockResolvedValue(makeInvoice({ total: 15055, vatAmt: 1964 }));
      prisma.invoice.findUnique.mockResolvedValue(makeInvoice({ total: 15055, vatAmt: 1964 }));

      await handler.finalizeRefundFromCancellation({ refundRequestId: 'rr-1', idempotencyKey: 'idemp-1' });

      const params = moyasar.createRefund.mock.calls[0][1];
      expect(params.amount).toBe(15055);
      expect(typeof params.amount).toBe('number');
      expect(prisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ refundedAmount: { increment: 15055 } }),
        }),
      );
      expect(prisma.outboxEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          payload: expect.objectContaining({
            payload: expect.objectContaining({ amount: 15055 }),
          }),
        }),
      });
    });

    it('does not enqueue before commit; the transactional outbox is the only completion transport', async () => {
      prisma.refundRequest.findUniqueOrThrow.mockResolvedValue({
        id: 'rr-1',
        paymentId: 'pay-1',
        amount: 100,
        invoiceId: 'inv-1',
        status: RefundStatus.PROCESSING,
      });
      prisma.payment.findUniqueOrThrow.mockResolvedValue({ id: 'pay-1', gatewayRef: 'gateway-ref-1' });
      moyasar.createRefund.mockResolvedValue({ id: 'moy-ref-1' });
      prisma.refundRequest.updateMany.mockResolvedValue({ count: 1 });
      prisma.invoice.findUniqueOrThrow.mockResolvedValue(makeInvoice());
      prisma.invoice.findUnique.mockResolvedValue(makeInvoice());
      await handler.finalizeRefundFromCancellation({ refundRequestId: 'rr-1', idempotencyKey: 'idemp-1' });

      expect(prisma.outboxEvent.create).toHaveBeenCalledTimes(1);
      expect(eventBus.publish).not.toHaveBeenCalled();
    });

    it('retries an unknown provider call with the same key and never marks it FAILED on a transient error', async () => {
      const processing = {
        id: 'rr-1', paymentId: 'pay-1', amount: 100, invoiceId: 'inv-1',
        status: RefundStatus.PROCESSING, gatewayRef: null,
        idempotencyKey: 'idemp-1', sourceEventId: '11111111-1111-4111-8111-111111111111',
        providerState: 'CALL_UNKNOWN',
      };
      prisma.refundRequest.findUniqueOrThrow.mockResolvedValue(processing);
      prisma.payment.findUniqueOrThrow.mockResolvedValue({ id: 'pay-1', gatewayRef: 'gateway-ref-1' });
      prisma.refundRequest.updateMany.mockResolvedValue({ count: 1 });
      moyasar.createRefund
        .mockRejectedValueOnce(new Error('timeout after provider may have accepted'))
        .mockResolvedValueOnce({ id: 'moy-ref-1' });
      prisma.invoice.findUniqueOrThrow.mockResolvedValue(makeInvoice());

      await expect(handler.finalizeRefundFromCancellation({
        refundRequestId: 'rr-1', idempotencyKey: 'idemp-1',
        sourceEventId: '11111111-1111-4111-8111-111111111111',
      })).rejects.toThrow('timeout');
      await handler.finalizeRefundFromCancellation({
        refundRequestId: 'rr-1', idempotencyKey: 'idemp-1',
        sourceEventId: '11111111-1111-4111-8111-111111111111',
      });

      expect(moyasar.createRefund).toHaveBeenCalledTimes(2);
      expect(moyasar.createRefund.mock.calls[0][1].idempotencyKey).toBe('idemp-1');
      expect(moyasar.createRefund.mock.calls[1][1].idempotencyKey).toBe('idemp-1');
      expect(prisma.refundRequest.updateMany).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          providerState: 'CALL_UNKNOWN',
          lastProviderError: expect.stringContaining('retry'),
        }),
      }));
    });

    it('records a definitive provider 404 as FAILED while rethrowing the first consumer delivery', async () => {
      prisma.refundRequest.findUniqueOrThrow.mockResolvedValue({
        id: 'rr-1', paymentId: 'pay-1', amount: 100, invoiceId: 'inv-1',
        status: RefundStatus.PROCESSING, gatewayRef: null,
        idempotencyKey: 'idemp-1', sourceEventId: null, providerState: 'NOT_CALLED',
      });
      prisma.payment.findUniqueOrThrow.mockResolvedValue({ id: 'pay-1', gatewayRef: 'missing-payment' });
      moyasar.createRefund.mockRejectedValue(new NotFoundException('Moyasar payment not found'));

      await expect(handler.finalizeRefundFromCancellation({
        refundRequestId: 'rr-1', idempotencyKey: 'idemp-1',
      })).rejects.toThrow(NotFoundException);

      expect(prisma.refundRequest.updateMany).toHaveBeenCalledWith({
        where: { id: 'rr-1', status: RefundStatus.PROCESSING },
        data: expect.objectContaining({
          status: RefundStatus.FAILED,
          providerState: 'FAILED',
        }),
      });
    });

    it('acknowledges replay of a durably failed provider outcome without another call', async () => {
      prisma.refundRequest.findUniqueOrThrow.mockResolvedValue({
        id: 'rr-1', paymentId: 'pay-1', amount: 100, invoiceId: 'inv-1',
        status: RefundStatus.FAILED, gatewayRef: null,
        idempotencyKey: 'idemp-1', sourceEventId: null, providerState: 'FAILED',
      });

      await handler.finalizeRefundFromCancellation({ refundRequestId: 'rr-1', idempotencyKey: 'idemp-1' });

      expect(moyasar.createRefund).not.toHaveBeenCalled();
      expect(prisma.payment.findUniqueOrThrow).not.toHaveBeenCalled();
    });

    it('recovers a crash after provider confirmation without a second provider mutation', async () => {
      const beforeProvider = {
        id: 'rr-1', paymentId: 'pay-1', amount: 100, invoiceId: 'inv-1',
        status: RefundStatus.PROCESSING, gatewayRef: null,
        idempotencyKey: 'idemp-1', sourceEventId: null, providerState: 'NOT_CALLED',
      };
      const providerConfirmed = {
        ...beforeProvider, gatewayRef: 'moy-ref-1', providerState: 'CONFIRMED',
      };
      prisma.refundRequest.findUniqueOrThrow
        .mockResolvedValueOnce(beforeProvider)
        .mockResolvedValueOnce(providerConfirmed);
      prisma.payment.findUniqueOrThrow.mockResolvedValue({ id: 'pay-1', gatewayRef: 'gateway-ref-1' });
      moyasar.createRefund.mockResolvedValue({ id: 'moy-ref-1' });
      prisma.refundRequest.updateMany.mockResolvedValue({ count: 1 });
      prisma.invoice.findUniqueOrThrow.mockResolvedValue(makeInvoice());
      prisma.$transaction
        .mockRejectedValueOnce(new Error('crash before accounting commit'))
        .mockImplementationOnce(async (cb: (tx: unknown) => Promise<unknown>) => cb(prisma));

      await expect(handler.finalizeRefundFromCancellation({
        refundRequestId: 'rr-1', idempotencyKey: 'idemp-1',
      })).rejects.toThrow('crash before accounting commit');
      await handler.finalizeRefundFromCancellation({ refundRequestId: 'rr-1', idempotencyKey: 'idemp-1' });

      expect(moyasar.createRefund).toHaveBeenCalledTimes(1);
      expect(prisma.outboxEvent.create).toHaveBeenCalledTimes(1);
    });
  });

  // ── execute ───────────────────────────────────────────────────────────────

  describe('execute', () => {
    it('acknowledges a source-event replay after DB finalize without another refund or preflight', async () => {
      prisma.refundRequest.findUnique.mockResolvedValue({
        id: 'rr-existing',
        paymentId: 'pay-1',
        status: RefundStatus.COMPLETED,
        idempotencyKey: 'refund:rr-existing',
      });
      prisma.payment.findUniqueOrThrow.mockResolvedValue({
        id: 'pay-1',
        status: PaymentStatus.REFUNDED,
      });

      const result = await handler.execute({
        paymentId: 'pay-1',
        reason: 'legacy cancellation replay',
        sourceEventId: '11111111-1111-4111-8111-111111111111',
      });

      expect(result).toMatchObject({ id: 'pay-1', status: PaymentStatus.REFUNDED });
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.refundRequest.create).not.toHaveBeenCalled();
      expect(moyasar.createRefund).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when payment is not found', async () => {
      prisma.$transaction.mockImplementation(async (cb: (tx: any) => Promise<any>) => {
        prisma.$queryRaw.mockResolvedValueOnce([]);
        return cb(prisma);
      });

      await expect(
        handler.execute({ paymentId: 'pay-1', reason: 'test' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when payment is not COMPLETED', async () => {
      prisma.$transaction.mockImplementation(async (cb: (tx: any) => Promise<any>) => {
        prisma.$queryRaw.mockResolvedValueOnce(makePaymentRow({ status: PaymentStatus.PENDING }));
        return cb(prisma);
      });

      await expect(
        handler.execute({ paymentId: 'pay-1', reason: 'test' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when payment has no gatewayRef', async () => {
      prisma.$transaction.mockImplementation(async (cb: (tx: any) => Promise<any>) => {
        prisma.$queryRaw.mockResolvedValueOnce(makePaymentRow({ gatewayRef: null }));
        return cb(prisma);
      });

      await expect(
        handler.execute({ paymentId: 'pay-1', reason: 'test' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when an in-flight refund already exists', async () => {
      prisma.$transaction.mockImplementation(async (cb: (tx: any) => Promise<any>) => {
        prisma.$queryRaw.mockResolvedValueOnce(makePaymentRow());
        prisma.refundRequest.findFirst.mockResolvedValueOnce({ id: 'rr-existing' });
        return cb(prisma);
      });

      await expect(
        handler.execute({ paymentId: 'pay-1', reason: 'test' }),
      ).rejects.toThrow('Payment refund is already processing');
    });

    it('P1: rejects an over-refund beyond the outstanding balance and never calls moyasar', async () => {
      prisma.$transaction.mockImplementation(async (cb: (tx: any) => Promise<any>) => {
        // Payment of 100 halalas with 40 already refunded → outstanding = 60.
        prisma.$queryRaw.mockResolvedValueOnce(makePaymentRow({ amount: 100, refundedAmount: 40 }));
        prisma.invoice.findUniqueOrThrow.mockResolvedValueOnce(makeInvoice());
        prisma.refundRequest.findFirst.mockResolvedValueOnce(null);
        return cb(prisma);
      });

      await expect(
        handler.execute({ paymentId: 'pay-1', reason: 'test', amount: 61 }),
      ).rejects.toThrow(BadRequestException);

      expect(moyasar.createRefund).not.toHaveBeenCalled();
      expect(prisma.refundRequest.create).not.toHaveBeenCalled();
    });

    it('P1: idempotencyKey passed to moyasar is keyed on reqId, not on the amount', async () => {
      let txCallCount = 0;
      prisma.$transaction.mockImplementation(async (cb: (tx: any) => Promise<any>) => {
        txCallCount++;
        if (txCallCount === 1) {
          prisma.$queryRaw.mockResolvedValueOnce(makePaymentRow({ amount: 100, refundedAmount: 0 }));
          prisma.invoice.findUniqueOrThrow.mockResolvedValueOnce(makeInvoice());
          prisma.refundRequest.findFirst.mockResolvedValueOnce(null);
          prisma.refundRequest.create.mockResolvedValueOnce({ id: 'test-uuid-1234' });
        } else if (txCallCount === 2) {
          prisma.refundRequest.update.mockResolvedValueOnce({ id: 'test-uuid-1234' });
          prisma.payment.update.mockResolvedValueOnce({ id: 'pay-1', status: PaymentStatus.REFUNDED });
          prisma.invoice.findUniqueOrThrow.mockResolvedValueOnce(makeInvoice());
        }
        return cb(prisma);
      });

      moyasar.createRefund.mockResolvedValue({ id: 'moy-ref-1' });

      await handler.execute({ paymentId: 'pay-1', reason: 'test', amount: 50 });

      expect(moyasar.createRefund).toHaveBeenCalledWith(
        DEFAULT_ORG_ID,
        expect.objectContaining({ idempotencyKey: 'refund:test-uuid-1234' }),
      );
      const params = moyasar.createRefund.mock.calls[0][1];
      expect(params.idempotencyKey).not.toBe('refund:pay-1:50.00');
    });

    it('full success path: creates refund request, calls Moyasar, finalizes DB, and commits an outbox event', async () => {
      let txCallCount = 0;
      prisma.$transaction.mockImplementation(async (cb: (tx: any) => Promise<any>) => {
        txCallCount++;
        if (txCallCount === 1) {
          prisma.$queryRaw.mockResolvedValueOnce(makePaymentRow());
          prisma.invoice.findUniqueOrThrow.mockResolvedValueOnce(makeInvoice());
          prisma.refundRequest.findFirst.mockResolvedValueOnce(null);
          prisma.refundRequest.create.mockResolvedValueOnce({ id: 'test-uuid-1234' });
        } else if (txCallCount === 2) {
          prisma.refundRequest.update.mockResolvedValueOnce({ id: 'test-uuid-1234' });
          prisma.payment.update.mockResolvedValueOnce({ id: 'pay-1', status: PaymentStatus.REFUNDED });
          prisma.invoice.findUniqueOrThrow.mockResolvedValueOnce(makeInvoice());
        }
        return cb(prisma);
      });

      moyasar.createRefund.mockResolvedValue({ id: 'moy-ref-1' });

      const result = await handler.execute({ paymentId: 'pay-1', reason: 'test' });

      expect(result.status).toBe(PaymentStatus.REFUNDED);
      expect(moyasar.createRefund).toHaveBeenCalledWith(DEFAULT_ORG_ID, expect.any(Object));
      expect(prisma.outboxEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          id: 'test-uuid-1234',
          eventType: 'finance.refund.completed',
        }),
      });
      expect(eventBus.publish).not.toHaveBeenCalled();
    });

    it('keeps an ambiguous Moyasar failure PROCESSING/CALL_UNKNOWN for stable-key retry', async () => {
      prisma.$transaction.mockImplementation(async (cb: (tx: any) => Promise<any>) => {
        prisma.$queryRaw.mockResolvedValueOnce(makePaymentRow());
        prisma.invoice.findUniqueOrThrow.mockResolvedValueOnce(makeInvoice());
        prisma.refundRequest.findFirst.mockResolvedValueOnce(null);
        prisma.refundRequest.create.mockResolvedValueOnce({ id: 'test-uuid-1234' });
        return cb(prisma);
      });

      moyasar.createRefund.mockRejectedValue(new Error('Moyasar declined'));
      prisma.refundRequest.update.mockResolvedValue({ id: 'test-uuid-1234' });

      await expect(handler.execute({ paymentId: 'pay-1', reason: 'test' })).rejects.toThrow('Moyasar declined');

      expect(prisma.refundRequest.update).toHaveBeenCalledWith({
        where: { id: 'test-uuid-1234' },
        data: expect.objectContaining({
          providerState: 'CALL_UNKNOWN',
          lastProviderError: expect.stringContaining('retry'),
        }),
      });
    });

    it('does not call the provider when persisting CALL_UNKNOWN fails before the external boundary', async () => {
      prisma.$transaction.mockImplementation(async (cb: (tx: any) => Promise<any>) => {
        prisma.$queryRaw.mockResolvedValueOnce(makePaymentRow());
        prisma.invoice.findUniqueOrThrow.mockResolvedValueOnce(makeInvoice());
        prisma.refundRequest.findFirst.mockResolvedValueOnce(null);
        prisma.refundRequest.create.mockResolvedValueOnce({ id: 'test-uuid-1234' });
        return cb(prisma);
      });

      prisma.refundRequest.update.mockRejectedValue(new Error('DB write failed'));

      await expect(handler.execute({ paymentId: 'pay-1', reason: 'test' })).rejects.toThrow('DB write failed');
      expect(moyasar.createRefund).not.toHaveBeenCalled();
    });

    it('persists gatewayRef and throws when DB finalize fails after Moyasar success', async () => {
      let txCallCount = 0;
      prisma.$transaction.mockImplementation(async (cb: (tx: any) => Promise<any>) => {
        txCallCount++;
        if (txCallCount === 1) {
          prisma.$queryRaw.mockResolvedValueOnce(makePaymentRow());
          prisma.invoice.findUniqueOrThrow.mockResolvedValueOnce(makeInvoice());
          prisma.refundRequest.findFirst.mockResolvedValueOnce(null);
          prisma.refundRequest.create.mockResolvedValueOnce({ id: 'test-uuid-1234' });
          return cb(prisma);
        }
        throw new Error('DB deadlock');
      });

      moyasar.createRefund.mockResolvedValue({ id: 'moy-ref-1' });
      prisma.refundRequest.update.mockResolvedValue({ id: 'test-uuid-1234' });

      await expect(handler.execute({ paymentId: 'pay-1', reason: 'test' })).rejects.toThrow('DB deadlock');

      expect(prisma.refundRequest.update).toHaveBeenCalledWith({
        where: { id: 'test-uuid-1234' },
        data: expect.objectContaining({
          gatewayRef: 'moy-ref-1',
          providerState: 'CONFIRMED',
        }),
      });
    });

    it('rethrows when durable provider confirmation cannot be persisted', async () => {
      let txCallCount = 0;
      prisma.$transaction.mockImplementation(async (cb: (tx: any) => Promise<any>) => {
        txCallCount++;
        if (txCallCount === 1) {
          prisma.$queryRaw.mockResolvedValueOnce(makePaymentRow());
          prisma.invoice.findUniqueOrThrow.mockResolvedValueOnce(makeInvoice());
          prisma.refundRequest.findFirst.mockResolvedValueOnce(null);
          prisma.refundRequest.create.mockResolvedValueOnce({ id: 'test-uuid-1234' });
          return cb(prisma);
        }
        throw new Error('DB deadlock');
      });

      moyasar.createRefund.mockResolvedValue({ id: 'moy-ref-1' });
      prisma.refundRequest.update
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce(new Error('persist provider confirmation failed'));

      await expect(handler.execute({ paymentId: 'pay-1', reason: 'test' }))
        .rejects.toThrow('persist provider confirmation failed');
    });

    it('does not depend on an in-memory publish after accounting commits', async () => {
      let txCallCount = 0;
      prisma.$transaction.mockImplementation(async (cb: (tx: any) => Promise<any>) => {
        txCallCount++;
        if (txCallCount === 1) {
          prisma.$queryRaw.mockResolvedValueOnce(makePaymentRow());
          prisma.invoice.findUniqueOrThrow.mockResolvedValueOnce(makeInvoice());
          prisma.refundRequest.findFirst.mockResolvedValueOnce(null);
          prisma.refundRequest.create.mockResolvedValueOnce({ id: 'test-uuid-1234' });
        } else if (txCallCount === 2) {
          prisma.refundRequest.update.mockResolvedValueOnce({ id: 'test-uuid-1234' });
          prisma.payment.update.mockResolvedValueOnce({ id: 'pay-1', status: PaymentStatus.REFUNDED });
          prisma.invoice.findUniqueOrThrow.mockResolvedValueOnce(makeInvoice());
        }
        return cb(prisma);
      });

      moyasar.createRefund.mockResolvedValue({ id: 'moy-ref-1' });
      eventBus.publish.mockRejectedValue(new Error('bus down'));

      const result = await handler.execute({ paymentId: 'pay-1', reason: 'test' });

      expect(result.status).toBe(PaymentStatus.REFUNDED);
      expect(prisma.outboxEvent.create).toHaveBeenCalledTimes(1);
      expect(eventBus.publish).not.toHaveBeenCalled();
    });

    it('R-08: allows a second refund against a PARTIALLY_REFUNDED payment (was blocked before)', async () => {
      let txCallCount = 0;
      prisma.$transaction.mockImplementation(async (cb: (tx: any) => Promise<any>) => {
        txCallCount++;
        if (txCallCount === 1) {
          // 100 paid, 40 already refunded, status PARTIALLY_REFUNDED → outstanding 60.
          prisma.$queryRaw.mockResolvedValueOnce(
            makePaymentRow({ status: PaymentStatus.PARTIALLY_REFUNDED, amount: 100, refundedAmount: 40 }),
          );
          prisma.invoice.findUniqueOrThrow.mockResolvedValueOnce(makeInvoice({ refundedAmount: 40 }));
          prisma.refundRequest.findFirst.mockResolvedValueOnce(null);
          prisma.refundRequest.create.mockResolvedValueOnce({ id: 'test-uuid-1234' });
        } else if (txCallCount === 2) {
          prisma.refundRequest.update.mockResolvedValueOnce({ id: 'test-uuid-1234' });
          prisma.invoice.findUniqueOrThrow.mockResolvedValueOnce(makeInvoice({ refundedAmount: 40 }));
          prisma.payment.update.mockResolvedValueOnce({ id: 'pay-1', status: PaymentStatus.REFUNDED });
        }
        return cb(prisma);
      });
      moyasar.createRefund.mockResolvedValue({ id: 'moy-ref-2' });

      await handler.execute({ paymentId: 'pay-1', reason: 'second partial', amount: 60 });

      expect(moyasar.createRefund).toHaveBeenCalledWith(
        DEFAULT_ORG_ID,
        expect.objectContaining({ amount: 60 }),
      );
    });

    it('R-08: rejects an over-refund on a PARTIALLY_REFUNDED payment via the outstanding clamp', async () => {
      prisma.$transaction.mockImplementation(async (cb: (tx: any) => Promise<any>) => {
        prisma.$queryRaw.mockResolvedValueOnce(
          makePaymentRow({ status: PaymentStatus.PARTIALLY_REFUNDED, amount: 100, refundedAmount: 40 }),
        );
        prisma.invoice.findUniqueOrThrow.mockResolvedValueOnce(makeInvoice({ refundedAmount: 40 }));
        prisma.refundRequest.findFirst.mockResolvedValueOnce(null);
        return cb(prisma);
      });

      // outstanding = 60; asking for 61 must be rejected, no gateway call.
      await expect(
        handler.execute({ paymentId: 'pay-1', reason: 'too much', amount: 61 }),
      ).rejects.toThrow(BadRequestException);
      expect(moyasar.createRefund).not.toHaveBeenCalled();
    });
  });
});
