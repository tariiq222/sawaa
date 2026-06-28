import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ApproveRefundHandler } from './approve-refund.handler';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { MoyasarApiClient } from '../moyasar-api/moyasar-api.client';
import { EventBusService } from '../../../infrastructure/events';
import { RefundCompletedEvent } from '../events/refund-completed.event';

jest.mock('./refund-vat.helper', () => ({
  computeRefundAccounting: jest.fn().mockReturnValue({
    newInvoiceStatus: 'REFUNDED',
    newRefundedAmount: new Prisma.Decimal(100),
    newRefundedVatAmt: new Prisma.Decimal(15),
  }),
}));

import { computeRefundAccounting } from './refund-vat.helper';

const buildPrisma = () => ({
  refundRequest: {
    findFirst: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    update: jest.fn(),
    // Default: the guarded PENDING_REVIEW → PROCESSING / PROCESSING → COMPLETED
    // flip wins (claims 1 row). Tests override to 0 to simulate a concurrent
    // writer that already moved the row past the guarded status.
    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
  },
  invoice: {
    findUniqueOrThrow: jest.fn(),
    update: jest.fn(),
  },
  payment: {
    findUniqueOrThrow: jest.fn().mockResolvedValue({
      gatewayRef: 'moyasar-pay-1',
      amount: new Prisma.Decimal(100),
      refundedAmount: new Prisma.Decimal(0),
    }),
    update: jest.fn(),
  },
});

describe('ApproveRefundHandler', () => {
  let handler: ApproveRefundHandler;
  let prisma: any;
  let moyasarClient: { createRefund: jest.Mock };
  let eventBus: { publish: jest.Mock };
  let txMock: ReturnType<typeof buildPrisma>;
  let rlsTransaction: { withTransaction: jest.Mock };

  beforeEach(async () => {
    prisma = buildPrisma();
    txMock = buildPrisma();

    rlsTransaction = {
      withTransaction: jest
        .fn()
        .mockImplementation(async (fn: (tx: typeof txMock) => Promise<unknown>) => fn(txMock)),
    };

    prisma.$transaction = jest
      .fn()
      .mockImplementation(async (fn: (tx: typeof txMock) => Promise<unknown>) => fn(txMock));

    moyasarClient = {
      createRefund: jest.fn().mockResolvedValue({ id: 'moyasar-refund-1' }),
    };

    eventBus = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApproveRefundHandler,
        { provide: PrismaService, useValue: prisma },
        { provide: RlsTransactionService, useValue: rlsTransaction },
        { provide: MoyasarApiClient, useValue: moyasarClient },
        { provide: EventBusService, useValue: eventBus },
      ],
    }).compile();

    handler = module.get<ApproveRefundHandler>(ApproveRefundHandler);
  });

  const refundRequestBase = {
    id: 'rr-1',
    paymentId: 'pay-1',
    invoiceId: 'inv-1',
    amount: new Prisma.Decimal(100),
    status: 'PENDING_REVIEW',
    reason: 'Customer request',
    requestedBy: 'admin-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    processedBy: null,
    processedAt: null,
    gatewayRef: null,
  };

  it('should throw NotFoundException when refund request not found', async () => {
    prisma.refundRequest.findFirst.mockResolvedValue(null);
    await expect(handler.execute({ refundRequestId: 'missing', approvedBy: 'admin' })).rejects.toThrow(NotFoundException);
  });

  /** Wire txMock for a successful guarded finalize (PROCESSING → COMPLETED wins). */
  const stubSuccessfulFinalize = () => {
    txMock.refundRequest.updateMany.mockResolvedValue({ count: 1 });
    txMock.refundRequest.findUniqueOrThrow.mockResolvedValue({ id: 'rr-1', status: 'COMPLETED' });
    txMock.invoice.findUniqueOrThrow.mockResolvedValue({
      total: new Prisma.Decimal(100),
      vatAmt: new Prisma.Decimal(15),
      refundedAmount: new Prisma.Decimal(0),
    });
    txMock.invoice.update.mockResolvedValue({ id: 'inv-1', bookingId: 'book-1', currency: 'SAR' });
    txMock.payment.update.mockResolvedValue({});
  };

  it('should complete refund successfully', async () => {
    prisma.refundRequest.findFirst.mockResolvedValue(refundRequestBase);
    stubSuccessfulFinalize();

    const result = await handler.execute({ refundRequestId: 'rr-1', approvedBy: 'admin' });

    // PENDING_REVIEW → PROCESSING is an atomic guarded updateMany, not a bare update.
    expect(prisma.refundRequest.updateMany).toHaveBeenCalledWith({
      where: { id: 'rr-1', status: 'PENDING_REVIEW' },
      data: { status: 'PROCESSING', processedBy: 'admin', processedAt: expect.any(Date) },
    });
    expect(moyasarClient.createRefund).toHaveBeenCalledWith(expect.any(String), {
      paymentId: 'moyasar-pay-1',
      amount: 100,
      idempotencyKey: 'refund:rr-1',
    });
    // PROCESSING → COMPLETED is also a guarded updateMany inside the tx.
    expect(txMock.refundRequest.updateMany).toHaveBeenCalledWith({
      where: { id: 'rr-1', status: 'PROCESSING' },
      data: { status: 'COMPLETED', gatewayRef: 'moyasar-refund-1' },
    });
    expect(txMock.payment.update).toHaveBeenCalledWith({
      where: { id: 'pay-1' },
      data: { status: 'REFUNDED', refundedAmount: { increment: 100 } },
    });
    expect(eventBus.publish).toHaveBeenCalledWith(
      'finance.refund.completed',
      expect.any(Object),
    );
    expect(result.status).toBe('COMPLETED');
    expect(result.gatewayRef).toBe('moyasar-refund-1');
  });

  it('throws Conflict and never calls Moyasar when a concurrent approve already won the PROCESSING flip', async () => {
    prisma.refundRequest.findFirst.mockResolvedValue(refundRequestBase);
    // Simulate the loser of a concurrent approve race: the guarded flip claims 0 rows.
    prisma.refundRequest.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      handler.execute({ refundRequestId: 'rr-1', approvedBy: 'admin' }),
    ).rejects.toThrow(ConflictException);

    // Critical money-safety assertion: the loser bails BEFORE the gateway, so no
    // second real-money refund and no second accounting application.
    expect(moyasarClient.createRefund).not.toHaveBeenCalled();
    expect(rlsTransaction.withTransaction).not.toHaveBeenCalled();
  });

  it('applies accounting exactly once when the cron already finalized the row (in-tx guard claims 0)', async () => {
    prisma.refundRequest.findFirst.mockResolvedValue(refundRequestBase);
    // The PENDING_REVIEW → PROCESSING flip wins (this approve owns the gateway call)...
    prisma.refundRequest.updateMany.mockResolvedValue({ count: 1 });
    // ...but by the time the finalize tx runs, the reconcile cron already flipped
    // PROCESSING → COMPLETED, so the in-tx guarded updateMany claims 0 rows.
    txMock.refundRequest.updateMany.mockResolvedValue({ count: 0 });

    const result = await handler.execute({ refundRequestId: 'rr-1', approvedBy: 'admin' });

    // Moyasar is idempotent on the key, so the call is fine — but the ledger must
    // NOT be touched a second time.
    expect(txMock.invoice.update).not.toHaveBeenCalled();
    expect(txMock.payment.update).not.toHaveBeenCalled();
    expect(eventBus.publish).not.toHaveBeenCalled();
    expect(result.status).toBe('COMPLETED');
    expect(result.gatewayRef).toBe('moyasar-refund-1');
  });

  it('rejects an approval that would over-refund past the payment outstanding balance', async () => {
    prisma.refundRequest.findFirst.mockResolvedValue({
      ...refundRequestBase,
      amount: new Prisma.Decimal(100),
    });
    // Payment of 100 with 60 already refunded → only 40 outstanding; a 100 refund over-refunds.
    prisma.payment.findUniqueOrThrow.mockResolvedValue({
      gatewayRef: 'moyasar-pay-1',
      amount: new Prisma.Decimal(100),
      refundedAmount: new Prisma.Decimal(60),
    });

    await expect(
      handler.execute({ refundRequestId: 'rr-1', approvedBy: 'admin' }),
    ).rejects.toThrow(BadRequestException);

    // Clamp must fire before flipping the row or touching the gateway.
    expect(prisma.refundRequest.updateMany).not.toHaveBeenCalled();
    expect(moyasarClient.createRefund).not.toHaveBeenCalled();
  });

  it('should mark FAILED when Moyasar throws', async () => {
    prisma.refundRequest.findFirst.mockResolvedValue(refundRequestBase);
    moyasarClient.createRefund.mockRejectedValue(new Error('Moyasar error'));

    await expect(handler.execute({ refundRequestId: 'rr-1', approvedBy: 'admin' })).rejects.toThrow('Moyasar error');

    expect(prisma.refundRequest.update).toHaveBeenCalledWith({
      where: { id: 'rr-1' },
      data: { status: 'FAILED' },
    });
  });

  it('should leave in PROCESSING with gatewayRef when Moyasar succeeds but DB finalize fails', async () => {
    prisma.refundRequest.findFirst.mockResolvedValue(refundRequestBase);
    prisma.refundRequest.update.mockResolvedValue({ ...refundRequestBase, status: 'PROCESSING' });

    rlsTransaction.withTransaction.mockImplementation(() => {
      throw new Error('DB error');
    });

    await expect(handler.execute({ refundRequestId: 'rr-1', approvedBy: 'admin' })).rejects.toThrow('DB error');

    expect(prisma.refundRequest.update).toHaveBeenCalledWith({
      where: { id: 'rr-1' },
      data: { gatewayRef: 'moyasar-refund-1' },
    });
  });

  it('should handle persist gatewayRef failure after partial success', async () => {
    prisma.refundRequest.findFirst.mockResolvedValue(refundRequestBase);
    prisma.refundRequest.update.mockRejectedValue(new Error('Persist failed'));

    rlsTransaction.withTransaction.mockImplementation(() => {
      throw new Error('DB error');
    });

    await expect(handler.execute({ refundRequestId: 'rr-1', approvedBy: 'admin' })).rejects.toThrow('DB error');

    // The persist-gatewayRef update fails but is caught (not rethrown).
    expect(prisma.refundRequest.update).toHaveBeenCalledWith({
      where: { id: 'rr-1' },
      data: { gatewayRef: 'moyasar-refund-1' },
    });
  });

  it('should swallow event publish failure', async () => {
    prisma.refundRequest.findFirst.mockResolvedValue(refundRequestBase);
    stubSuccessfulFinalize();

    eventBus.publish.mockRejectedValue(new Error('Event bus down'));

    const result = await handler.execute({ refundRequestId: 'rr-1', approvedBy: 'admin' });
    expect(result.status).toBe('COMPLETED');
  });
});
