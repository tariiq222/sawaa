import { Test } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { PaymentStatus, RefundStatus } from '@prisma/client';
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
    $queryRaw: jest.fn(),
  };
  prisma.$transaction = jest.fn(async (cb: (tx: unknown) => Promise<unknown>) => await cb(prisma));

  const moyasar = { createRefund: jest.fn() };
  const eventBus = { publish: jest.fn().mockResolvedValue(undefined) };

  beforeEach(async () => {
    jest.clearAllMocks();
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

  const makePaymentRow = (overrides?: Partial<{ id: string; status: string; gatewayRef: string | null; amount: number; invoiceId: string }>) => [
    {
      id: 'pay-1',
      status: PaymentStatus.COMPLETED,
      gatewayRef: 'gateway-ref-1',
      amount: 100,
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

    it('throws BadRequestException when payment has no gatewayRef', async () => {
      prisma.$queryRaw.mockResolvedValue(makePaymentRow({ gatewayRef: null }));

      await expect(
        handler.createRefundRequestInTx(prisma as any, { paymentId: 'pay-1', reason: 'test' }),
      ).rejects.toThrow(BadRequestException);
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
      expect(result.idempotencyKey).toBe(`refund:pay-1:${(100).toFixed(2)}`);
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

    it('calls moyasar, updates DB in tx, and publishes event on success', async () => {
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
        data: { status: RefundStatus.COMPLETED, gatewayRef: 'moy-ref-1' },
      });
      expect(eventBus.publish).toHaveBeenCalledWith(
        'finance.refund.completed',
        expect.objectContaining({
          payload: expect.objectContaining({
            refundRequestId: 'rr-1',
            paymentId: 'pay-1',
            amount: 100,
          }),
        }),
      );
    });

    it('publishes event even when eventBus.publish rejects', async () => {
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
      eventBus.publish.mockRejectedValue(new Error('bus down'));

      // Should not throw because catch swallows the publish error
      await expect(
        handler.finalizeRefundFromCancellation({ refundRequestId: 'rr-1', idempotencyKey: 'idemp-1' }),
      ).resolves.toBeUndefined();

      expect(eventBus.publish).toHaveBeenCalledTimes(1);
    });
  });

  // ── execute ───────────────────────────────────────────────────────────────

  describe('execute', () => {
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

    it('full success path: creates refund request, calls moyasar, finalizes DB, publishes event', async () => {
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
      expect(eventBus.publish).toHaveBeenCalledWith(
        'finance.refund.completed',
        expect.objectContaining({
          payload: expect.objectContaining({ paymentId: 'pay-1' }),
        }),
      );
    });

    it('marks refund FAILED when Moyasar rejects the refund', async () => {
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
        data: { status: RefundStatus.FAILED },
      });
    });

    it('still throws when marking FAILED after Moyasar rejection also fails', async () => {
      prisma.$transaction.mockImplementation(async (cb: (tx: any) => Promise<any>) => {
        prisma.$queryRaw.mockResolvedValueOnce(makePaymentRow());
        prisma.invoice.findUniqueOrThrow.mockResolvedValueOnce(makeInvoice());
        prisma.refundRequest.findFirst.mockResolvedValueOnce(null);
        prisma.refundRequest.create.mockResolvedValueOnce({ id: 'test-uuid-1234' });
        return cb(prisma);
      });

      moyasar.createRefund.mockRejectedValue(new Error('Moyasar declined'));
      prisma.refundRequest.update.mockRejectedValue(new Error('DB write failed'));

      await expect(handler.execute({ paymentId: 'pay-1', reason: 'test' })).rejects.toThrow('Moyasar declined');
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
        data: { gatewayRef: 'moy-ref-1' },
      });
    });

    it('throws when even persisting gatewayRef after finalize failure fails', async () => {
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
      prisma.refundRequest.update.mockRejectedValue(new Error('persist gatewayRef failed'));

      await expect(handler.execute({ paymentId: 'pay-1', reason: 'test' })).rejects.toThrow('DB deadlock');
    });

    it('publishes event with catch when eventBus.publish rejects', async () => {
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
      expect(eventBus.publish).toHaveBeenCalledTimes(1);
    });
  });
});
