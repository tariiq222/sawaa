import { Test, TestingModule } from '@nestjs/testing';
import { RlsTransactionService } from '../../../infrastructure/database';
import { DenyRefundHandler } from './deny-refund.handler';

describe('DenyRefundHandler', () => {
  let handler: DenyRefundHandler;
  let tx: { refundRequest: { findFirst: jest.Mock; update: jest.Mock; findUniqueOrThrow: jest.Mock } };

  beforeEach(async () => {
    tx = { refundRequest: { findFirst: jest.fn(), update: jest.fn(), findUniqueOrThrow: jest.fn().mockResolvedValue({ sourceEventId: null }) } };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DenyRefundHandler,
        { provide: RlsTransactionService, useValue: { withTransaction: jest.fn(work => work(tx)) } },
      ],
    }).compile();
    handler = module.get<DenyRefundHandler>(DenyRefundHandler);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should execute', async () => {
    tx.refundRequest.findFirst.mockResolvedValue({ id: 'test' });
    await handler.execute({refundRequestId:"00000000-0000-0000-0000-000000000001",deniedBy:"test",reason:"test"});
    
    tx.refundRequest.findFirst.mockResolvedValue(null);
    await expect(handler.execute({refundRequestId:"00000000-0000-0000-0000-000000000001",deniedBy:"test",reason:"test"})).rejects.toThrow();
  });
});


describe('cancellation denial outcome', () => {
  it('captures DENIED in the same transaction and preserves ordinary denial behavior', async () => {
    const { stableEventId } = await import('../../../common/events');
    const cancellationEventId = '22222222-2222-4222-8222-222222222222';
    const request = { id: 'refund-1', status: 'PENDING_REVIEW', sourceEventId: stableEventId(`${cancellationEventId}:payment:payment-1`), paymentId: 'payment-1', clientId: 'client-1', amount: 20, invoice: { bookingId: 'booking-1' } };
    const tx = {
      refundRequest: { findFirst: jest.fn(async () => request), findUniqueOrThrow: jest.fn(async () => request), update: jest.fn(async ({ data }) => Object.assign(request, data)) },
      bookingStatusLog: { findFirst: jest.fn().mockResolvedValue({ sourceActionResult: { cancellationEventId, refund: { refundAmount: 20 } } }) },
      outboxEvent: { findUnique: jest.fn().mockResolvedValue({ payload: { payload: { clientCancellation: { version: 1, initiatedBy: 'CLIENT', allocations: [{ paymentId: 'payment-1' }] } } } }), upsert: jest.fn() },
    };
    const rls = { withTransaction: jest.fn(async work => work(tx)) };
    const handler = new DenyRefundHandler(rls as never);
    await handler.execute({ refundRequestId: 'refund-1', deniedBy: 'staff-1', reason: 'denied' });
    expect(rls.withTransaction).toHaveBeenCalledTimes(1);
    expect(tx.refundRequest.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'refund-1', status: 'PENDING_REVIEW' } }));
    expect(tx.outboxEvent.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ eventType: 'finance.cancellation-refund.updated', payload: expect.objectContaining({ payload: expect.objectContaining({ status: 'DENIED', amount: 20 }) }) }) }));
  });
});
