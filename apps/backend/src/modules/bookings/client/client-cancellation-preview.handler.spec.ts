import { ClientCancellationPreviewHandler } from './client-cancellation-preview.handler';

describe('cancellation preview boundary', () => {
  it('restricts ownership and returns a quote without exposing payment allocations', async () => {
    const tx = {
      booking: { findFirst: jest.fn().mockResolvedValue({ id: 'b1', clientId: 'c1', branchId: 'branch', status: 'CONFIRMED', bookingType: 'INDIVIDUAL', checkedInAt: null, isHistoricalImport: false, packageCreditId: null, currency: 'SAR', scheduledAt: new Date(Date.now() + 3600000), endsAt: new Date(Date.now() + 7200000) }) },
      payment: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const rls = { withTransaction: jest.fn(fn => fn(tx)) };
    const settings = { execute: jest.fn().mockResolvedValue({ clientCancellationPolicyEnabled: true, clientCancelCutoffMode: 'BEFORE_START', clientCancelBeforeHours: 0, earlyCancelRefundPercent: 0, freeCancelBeforeHours: 24, freeCancelRefundType: 'NONE', lateCancelRefundPercent: 0, autoRefundOnCancel: false }) };
    const handler = new ClientCancellationPreviewHandler(rls as never, settings as never);
    const result = await handler.execute('b1', 'c1');
    expect(tx.booking.findFirst).toHaveBeenCalledWith({ where: { id: 'b1', clientId: 'c1' } });
    expect(result).toMatchObject({ canCancel: true, reasonCode: 'ALLOWED', refund: { status: 'NOT_APPLICABLE' }, quoteToken: expect.any(String) });
    expect(result).not.toHaveProperty('allocations');
    tx.booking.findFirst.mockResolvedValue(null as never);
    await expect(handler.execute('b2', 'other')).rejects.toThrow('Booking not found');
  });
});
