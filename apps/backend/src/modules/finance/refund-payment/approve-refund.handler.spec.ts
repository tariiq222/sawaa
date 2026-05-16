import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
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
    update: jest.fn(),
  },
  invoice: {
    findUniqueOrThrow: jest.fn(),
    update: jest.fn(),
  },
  payment: {
    findUniqueOrThrow: jest.fn().mockResolvedValue({ gatewayRef: 'moyasar-pay-1' }),
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

  it('should complete refund successfully', async () => {
    prisma.refundRequest.findFirst.mockResolvedValue(refundRequestBase);
    prisma.refundRequest.update.mockResolvedValue({ ...refundRequestBase, status: 'PROCESSING' });

    txMock.refundRequest.update.mockResolvedValue({ ...refundRequestBase, status: 'COMPLETED' });
    txMock.invoice.findUniqueOrThrow.mockResolvedValue({
      total: new Prisma.Decimal(100),
      vatAmt: new Prisma.Decimal(15),
      refundedAmount: new Prisma.Decimal(0),
    });
    txMock.invoice.update.mockResolvedValue({ id: 'inv-1', bookingId: 'book-1', currency: 'SAR' });
    txMock.payment.update.mockResolvedValue({});

    const result = await handler.execute({ refundRequestId: 'rr-1', approvedBy: 'admin' });

    expect(prisma.refundRequest.update).toHaveBeenCalledWith({
      where: { id: 'rr-1' },
      data: { status: 'PROCESSING', processedBy: 'admin', processedAt: expect.any(Date) },
    });
    expect(moyasarClient.createRefund).toHaveBeenCalledWith(expect.any(String), {
      paymentId: 'moyasar-pay-1',
      amount: 10000,
      idempotencyKey: 'refund:rr-1',
    });
    expect(txMock.refundRequest.update).toHaveBeenCalledWith({
      where: { id: 'rr-1' },
      data: { status: 'COMPLETED', gatewayRef: 'moyasar-refund-1' },
    });
    expect(txMock.payment.update).toHaveBeenCalledWith({
      where: { id: 'pay-1' },
      data: { status: 'REFUNDED' },
    });
    expect(eventBus.publish).toHaveBeenCalledWith(
      'finance.refund.completed',
      expect.any(Object),
    );
    expect(result.status).toBe('COMPLETED');
    expect(result.gatewayRef).toBe('moyasar-refund-1');
  });

  it('should mark FAILED when Moyasar throws', async () => {
    prisma.refundRequest.findFirst.mockResolvedValue(refundRequestBase);
    prisma.refundRequest.update.mockResolvedValue({ ...refundRequestBase, status: 'PROCESSING' });
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

    rlsTransaction.withTransaction.mockRejectedValue(new Error('DB error'));

    await expect(handler.execute({ refundRequestId: 'rr-1', approvedBy: 'admin' })).rejects.toThrow('DB error');

    expect(prisma.refundRequest.update).toHaveBeenCalledWith({
      where: { id: 'rr-1' },
      data: { gatewayRef: 'moyasar-refund-1' },
    });
  });

  it('should handle persist gatewayRef failure after partial success', async () => {
    prisma.refundRequest.findFirst.mockResolvedValue(refundRequestBase);
    prisma.refundRequest.update
      .mockResolvedValueOnce({ ...refundRequestBase, status: 'PROCESSING' })
      .mockRejectedValueOnce(new Error('Persist failed'));

    rlsTransaction.withTransaction.mockRejectedValue(new Error('DB error'));

    await expect(handler.execute({ refundRequestId: 'rr-1', approvedBy: 'admin' })).rejects.toThrow('DB error');

    // The second update (to persist gatewayRef) fails but is caught
    expect(prisma.refundRequest.update).toHaveBeenCalledTimes(2);
  });

  it('should swallow event publish failure', async () => {
    prisma.refundRequest.findFirst.mockResolvedValue(refundRequestBase);
    prisma.refundRequest.update.mockResolvedValue({ ...refundRequestBase, status: 'PROCESSING' });

    txMock.refundRequest.update.mockResolvedValue({ ...refundRequestBase, status: 'COMPLETED' });
    txMock.invoice.findUniqueOrThrow.mockResolvedValue({
      total: new Prisma.Decimal(100),
      vatAmt: new Prisma.Decimal(15),
      refundedAmount: new Prisma.Decimal(0),
    });
    txMock.invoice.update.mockResolvedValue({ id: 'inv-1', bookingId: 'book-1', currency: 'SAR' });
    txMock.payment.update.mockResolvedValue({});

    eventBus.publish.mockRejectedValue(new Error('Event bus down'));

    const result = await handler.execute({ refundRequestId: 'rr-1', approvedBy: 'admin' });
    expect(result.status).toBe('COMPLETED');
  });
});
