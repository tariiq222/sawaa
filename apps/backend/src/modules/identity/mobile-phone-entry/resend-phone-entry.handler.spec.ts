import { ResendPhoneEntryHandler } from './resend-phone-entry.handler';
import { EmailEntryDeliveryError } from '../mobile-email-entry/mobile-email-delivery';

describe('ResendPhoneEntryHandler', () => {
  let flow: any, tx: any, store: any, limiter: any, delivery: any, handler: ResendPhoneEntryHandler;
  beforeEach(() => {
    flow = { id: 'challenge', phone: '+966512345678', state: 'CODE_PENDING', attempts: 4, createdAt: new Date(), codeExpiresAt: new Date(Date.now() + 300000), consumedAt: null };
    tx = { mobilePhoneEntryFlow: { update: jest.fn(), updateMany: jest.fn(async () => ({ count: 1 })) } };
    store = { transaction: jest.fn(async (run: any) => run(tx)), lock: jest.fn(async () => flow), liveFlow: jest.fn(() => true) };
    limiter = { reserve: jest.fn(async () => 'reservation'), settle: jest.fn() };
    delivery = { send: jest.fn() };
    handler = new ResendPhoneEntryHandler(store, limiter, delivery);
  });
  it('locks before reserving, rotates code and resets attempts before dispatch', async () => {
    expect(await handler.execute({ challengeId: 'challenge' })).toMatchObject({ challengeId: 'challenge', maskedPhone: '+966***78', retryAfterSeconds: 60 });
    expect(store.lock).toHaveBeenCalledWith(tx, 'challenge');
    expect(store.lock.mock.invocationCallOrder[0]).toBeLessThan(limiter.reserve.mock.invocationCallOrder[0]);
    expect(tx.mobilePhoneEntryFlow.update).toHaveBeenCalledWith({ where: { id: 'challenge' }, data: { codeHash: expect.any(String), attempts: 0, codeExpiresAt: expect.any(Date) } });
    expect(tx.mobilePhoneEntryFlow.update.mock.invocationCallOrder[0]).toBeLessThan(delivery.send.mock.invocationCallOrder[0]);
    expect(limiter.reserve).toHaveBeenCalledWith('SMS', flow.phone);
    expect(limiter.settle).toHaveBeenCalledWith('reservation', 'accepted');
  });
  it.each(['DETAILS_PENDING', 'FAILED', 'CONSUMED'])('rejects %s without dispatch', async state => {
    flow.state = state;
    await expect(handler.execute({ challengeId: flow.id })).rejects.toMatchObject({ status: 400 });
    expect(limiter.reserve).not.toHaveBeenCalled();
    expect(delivery.send).not.toHaveBeenCalled();
  });
  it('rejects missing flow', async () => {
    store.lock.mockResolvedValue(null);
    await expect(handler.execute({ challengeId: 'missing' })).rejects.toMatchObject({ status: 400 });
  });
  it('rejects expired flow', async () => {
    store.liveFlow.mockReturnValue(false);
    await expect(handler.execute({ challengeId: flow.id })).rejects.toMatchObject({ status: 400 });
    expect(limiter.reserve).not.toHaveBeenCalled();
  });
  it('caps rotated expiry at total flow lifetime', async () => {
    flow.createdAt = new Date(Date.now() - 850000);
    const result = await handler.execute({ challengeId: flow.id });
    expect(tx.mobilePhoneEntryFlow.update.mock.calls[0][0].data.codeExpiresAt.getTime()).toBe(flow.createdAt.getTime() + 900000);
    expect(result.expiresIn).toBe(300);
  });
  it('closes only its own rotated code on send failure', async () => {
    delivery.send.mockRejectedValue(new EmailEntryDeliveryError('unknown'));
    await expect(handler.execute({ challengeId: flow.id })).rejects.toMatchObject({ status: 503 });
    const hash = tx.mobilePhoneEntryFlow.update.mock.calls[0][0].data.codeHash;
    expect(tx.mobilePhoneEntryFlow.updateMany).toHaveBeenCalledWith({
      where: { id: flow.id, codeHash: hash }, data: expect.objectContaining({ state: 'FAILED', codeHash: null }),
    });
    expect(limiter.settle).toHaveBeenCalledWith('reservation', 'unknown');
  });
  it('retains unknown send budget if persisting invalidation fails', async () => {
    delivery.send.mockRejectedValue(new EmailEntryDeliveryError('rejected'));
    tx.mobilePhoneEntryFlow.updateMany.mockRejectedValue(new Error('database'));
    await expect(handler.execute({ challengeId: flow.id })).rejects.toMatchObject({ status: 503 });
    expect(limiter.settle).toHaveBeenCalledWith('reservation', 'unknown');
  });
  it('refunds reservation if rotation fails before any delivery', async () => {
    tx.mobilePhoneEntryFlow.update.mockRejectedValue(new Error('database'));
    await expect(handler.execute({ challengeId: flow.id })).rejects.toMatchObject({ status: 503 });
    expect(limiter.settle).toHaveBeenCalledWith('reservation', 'rejected');
    expect(delivery.send).not.toHaveBeenCalled();
  });
  it('releases the row lock before the SMS network call', async () => {
    let open = 0;
    store.transaction.mockImplementation(async (run: any) => { open++; try { return await run(tx); } finally { open--; } });
    delivery.send.mockImplementation(async () => { expect(open).toBe(0); });
    await handler.execute({ challengeId: flow.id });
    expect(delivery.send).toHaveBeenCalledTimes(1);
  });
  it('does not rotate on rate limit', async () => {
    limiter.reserve.mockRejectedValue({ status: 429 });
    await expect(handler.execute({ challengeId: flow.id })).rejects.toMatchObject({ status: 429 });
    expect(tx.mobilePhoneEntryFlow.update).not.toHaveBeenCalled();
  });
});
