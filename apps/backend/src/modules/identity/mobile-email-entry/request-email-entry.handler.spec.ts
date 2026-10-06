import { RequestEmailEntryHandler } from './request-email-entry.handler';
import { MobileEmailFlowStore } from './mobile-email-flow.store';
describe('RequestEmailEntryHandler', () => {
  function fixture(fails = false) {
    const prisma = { mobileEmailFlow: { create: jest.fn().mockResolvedValue({ id: 'challenge' }), updateMany: jest.fn().mockResolvedValue({ count: 1 }) }, user: { findMany: jest.fn() }, client: { findMany: jest.fn() } };
    const delivery = { send: jest.fn(async () => { if (fails) throw Error('secret'); }) };
    const limiter = { reserve: jest.fn().mockResolvedValue({ id: 'r' }), settle: jest.fn() };
    return { prisma, delivery, limiter, handler: new RequestEmailEntryHandler(prisma as never, new MobileEmailFlowStore(prisma as never, {} as never), limiter as never, delivery as never) };
  }
  it('sends ownership proof without reading account tables and normalizes email', async () => {
    const { handler, prisma, delivery } = fixture();
    expect(await handler.execute({ email: 'Person@example.test' })).toMatchObject({ challengeId: 'challenge', expiresIn: 300 });
    expect(delivery.send).toHaveBeenCalledWith('EMAIL', 'person@example.test', expect.stringMatching(/^\d{6}$/));
    expect(prisma.user.findMany).not.toHaveBeenCalled();
    expect(prisma.client.findMany).not.toHaveBeenCalled();
    expect(prisma.mobileEmailFlow.create.mock.calls[0][0].data.state).toBe('EMAIL_SENDING');
  });
  it('releases only the hourly reservation when proof storage fails before delivery', async () => {
    const { handler, prisma, limiter, delivery } = fixture();
    prisma.mobileEmailFlow.create.mockRejectedValueOnce(Error('storage failure'));
    await expect(handler.execute({ email: 'person@example.test' })).rejects.toMatchObject({ status: 503 });
    expect(limiter.settle).toHaveBeenCalledWith({ id: 'r' }, 'rejected');
    expect(delivery.send).not.toHaveBeenCalled();
  });
  it('makes an undelivered code unusable and returns only a safe error', async () => {
    const { handler, prisma } = fixture(true);
    await expect(handler.execute({ email: 'person@example.test' })).rejects.toMatchObject({ response: { code: 'delivery_unavailable' } });
    expect(prisma.mobileEmailFlow.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { state: 'FAILED', emailCodeHash: null } }));
  });
});
