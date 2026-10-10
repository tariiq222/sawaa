import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { PaymentMethod, Prisma } from '@prisma/client';
import { ApproveRefundHandler } from './approve-refund.handler';

describe('ApproveRefundHandler', () => {
  const refundRequest = {
    id: 'rr-1',
    paymentId: 'pay-1',
    invoiceId: 'inv-1',
    amount: new Prisma.Decimal(100),
    status: 'PENDING_REVIEW',
    idempotencyKey: null,
  };
  let prisma: any;
  let refunds: { finalizeRefundFromCancellation: jest.Mock };
  let handler: ApproveRefundHandler;

  beforeEach(() => {
    prisma = {
      refundRequest: {
        findFirst: jest.fn().mockResolvedValue(refundRequest),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 'rr-1', status: 'COMPLETED', gatewayRef: 'moyasar-pay-1',
        }),
      },
      payment: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          method: PaymentMethod.ONLINE_CARD,
          gatewayRef: 'moyasar-pay-1',
          amount: new Prisma.Decimal(100),
          refundedAmount: new Prisma.Decimal(0),
        }),
      },
    };
    refunds = { finalizeRefundFromCancellation: jest.fn().mockResolvedValue(undefined) };
    handler = new ApproveRefundHandler(prisma, refunds as never);
  });

  it('rejects a request that is no longer pending review', async () => {
    prisma.refundRequest.findFirst.mockResolvedValue(null);

    await expect(handler.execute({ refundRequestId: 'missing', approvedBy: 'admin' }))
      .rejects.toThrow(NotFoundException);
    expect(refunds.finalizeRefundFromCancellation).not.toHaveBeenCalled();
  });

  it.each([
    [PaymentMethod.BANK_TRANSFER, 'bank-transfer-admin-reference'],
    [PaymentMethod.CASH, null],
  ])('rejects %s approval before claiming the request or entering the provider engine', async (method, gatewayRef) => {
    const pendingRequest = { ...refundRequest };
    prisma.refundRequest.findFirst.mockResolvedValue(pendingRequest);
    prisma.refundRequest.updateMany.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
      Object.assign(pendingRequest, data);
      return { count: 1 };
    });
    prisma.payment.findUniqueOrThrow.mockResolvedValue({
      method,
      gatewayRef,
      amount: new Prisma.Decimal(100),
      refundedAmount: new Prisma.Decimal(0),
    });
    refunds.finalizeRefundFromCancellation.mockRejectedValue(
      new BadRequestException('Payment cannot be refunded via Moyasar'),
    );

    await expect(handler.execute({ refundRequestId: 'rr-1', approvedBy: 'admin' }))
      .rejects.toThrow(BadRequestException);
    expect(pendingRequest).toEqual(refundRequest);
    expect(pendingRequest.status).toBe('PENDING_REVIEW');
    expect(prisma.refundRequest.updateMany).not.toHaveBeenCalled();
    expect(refunds.finalizeRefundFromCancellation).not.toHaveBeenCalled();
    expect(prisma.refundRequest.findUniqueOrThrow).not.toHaveBeenCalled();
  });

  it('delegates an approved refund to the leased reconciliation engine without a direct provider call', async () => {
    const result = await handler.execute({ refundRequestId: 'rr-1', approvedBy: 'admin' });

    expect(prisma.refundRequest.updateMany).toHaveBeenCalledWith({
      where: { id: 'rr-1', status: 'PENDING_REVIEW' },
      data: {
        status: 'PROCESSING',
        processedBy: 'admin',
        processedAt: expect.any(Date),
        idempotencyKey: 'refund:rr-1',
        providerState: 'BEFORE_CALL',
        lastProviderError: null,
      },
    });
    expect(refunds.finalizeRefundFromCancellation).toHaveBeenCalledWith({
      refundRequestId: 'rr-1',
      idempotencyKey: 'refund:rr-1',
    });
    expect(result).toEqual({ id: 'rr-1', status: 'COMPLETED', gatewayRef: 'moyasar-pay-1' });
  });

  it('keeps a card request pending when its provider reference is missing', async () => {
    prisma.payment.findUniqueOrThrow.mockResolvedValue({
      method: PaymentMethod.ONLINE_CARD,
      gatewayRef: null,
      amount: new Prisma.Decimal(100),
      refundedAmount: new Prisma.Decimal(0),
    });

    await expect(handler.execute({ refundRequestId: 'rr-1', approvedBy: 'admin' }))
      .rejects.toThrow(NotFoundException);
    expect(prisma.refundRequest.updateMany).not.toHaveBeenCalled();
    expect(refunds.finalizeRefundFromCancellation).not.toHaveBeenCalled();
  });

  it('never enters reconciliation when another approval wins the status CAS', async () => {
    prisma.refundRequest.updateMany.mockResolvedValue({ count: 0 });

    await expect(handler.execute({ refundRequestId: 'rr-1', approvedBy: 'admin' }))
      .rejects.toThrow(ConflictException);
    expect(refunds.finalizeRefundFromCancellation).not.toHaveBeenCalled();
  });

  it('rejects a request above the remaining local refundable balance', async () => {
    prisma.payment.findUniqueOrThrow.mockResolvedValue({
      method: PaymentMethod.ONLINE_CARD,
      gatewayRef: 'moyasar-pay-1',
      amount: new Prisma.Decimal(100),
      refundedAmount: new Prisma.Decimal(60),
    });

    await expect(handler.execute({ refundRequestId: 'rr-1', approvedBy: 'admin' }))
      .rejects.toThrow(BadRequestException);
    expect(prisma.refundRequest.updateMany).not.toHaveBeenCalled();
    expect(refunds.finalizeRefundFromCancellation).not.toHaveBeenCalled();
  });

  it('rethrows reconciliation failure and leaves its durable phase to the refund engine', async () => {
    refunds.finalizeRefundFromCancellation.mockRejectedValue(new Error('provider timeout'));

    await expect(handler.execute({ refundRequestId: 'rr-1', approvedBy: 'admin' }))
      .rejects.toThrow('provider timeout');
    expect(prisma.refundRequest.updateMany).toHaveBeenCalledTimes(1);
    expect(prisma.refundRequest.findUniqueOrThrow).not.toHaveBeenCalled();
  });
});
