import { RequestPhoneEntryHandler } from './request-phone-entry.handler';
import { EmailEntryDeliveryError } from '../mobile-email-entry/mobile-email-delivery';

describe('RequestPhoneEntryHandler', () => {
  const phone = '+966512345678';
  let tx: any, store: any, limiter: any, delivery: any, handler: RequestPhoneEntryHandler;
  beforeEach(() => {
    tx = { mobilePhoneEntryFlow: { create: jest.fn(async ({ data }) => ({ id: 'challenge', ...data })), updateMany: jest.fn(async () => ({ count: 1 })) } };
    store = { transaction: jest.fn(async (run: any) => run(tx)) };
    limiter = { reserve: jest.fn(async () => 'reservation'), settle: jest.fn() };
    delivery = { send: jest.fn() };
    handler = new RequestPhoneEntryHandler(store, limiter, delivery);
  });
  it.each(['0512345678', '00966512345678', '+966512345678'])('normalizes %s and sends without querying identities', async input => {
    expect(await handler.execute({ phone: input })).toEqual({ challengeId: 'challenge', maskedPhone: '+966***78', expiresIn: 300, retryAfterSeconds: 60 });
    expect(limiter.reserve).toHaveBeenCalledWith('SMS', phone);
    expect(delivery.send).toHaveBeenCalledWith('SMS', phone, expect.stringMatching(/^\d{6}$/));
    const data = tx.mobilePhoneEntryFlow.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ phone, state: 'CODE_PENDING', codeHash: expect.any(String) });
    expect(data.codeHash).not.toBe(delivery.send.mock.calls[0][2]);
    expect(limiter.settle).toHaveBeenCalledWith('reservation', 'accepted');
  });
  it.each(['+14155550100', '+966112345678', 'garbage', null, 123] as any[])('rejects unsupported %s before limiter or delivery', async phone => {
    await expect(handler.execute({ phone })).rejects.toMatchObject({ status: 400 });
    expect(limiter.reserve).not.toHaveBeenCalled();
    expect(store.transaction).not.toHaveBeenCalled();
  });
  it.each(['rejected', 'unknown'] as const)('closes only this code hash before reporting %s delivery failure', async outcome => {
    delivery.send.mockRejectedValue(new EmailEntryDeliveryError(outcome));
    await expect(handler.execute({ phone })).rejects.toMatchObject({ status: 503 });
    const hash = tx.mobilePhoneEntryFlow.create.mock.calls[0][0].data.codeHash;
    expect(tx.mobilePhoneEntryFlow.updateMany).toHaveBeenCalledWith({
      where: { id: 'challenge', codeHash: hash }, data: expect.objectContaining({ state: 'FAILED', codeHash: null }),
    });
    expect(limiter.settle).toHaveBeenCalledWith('reservation', outcome);
  });
  it('commits the flow before the SMS network call, never holding a transaction open across it', async () => {
    let open = 0;
    store.transaction.mockImplementation(async (run: any) => { open++; try { return await run(tx); } finally { open--; } });
    delivery.send.mockImplementation(async () => { expect(open).toBe(0); });
    await handler.execute({ phone });
    expect(delivery.send).toHaveBeenCalledTimes(1);
  });
  it('keeps the send budget as unknown if closing a failed flow cannot be persisted', async () => {
    delivery.send.mockRejectedValue(new EmailEntryDeliveryError('rejected'));
    tx.mobilePhoneEntryFlow.updateMany.mockRejectedValue(new Error('database'));
    await expect(handler.execute({ phone })).rejects.toMatchObject({ status: 503 });
    expect(limiter.settle).toHaveBeenCalledWith('reservation', 'unknown');
  });
  it('settles rejected reservation when creating the flow fails', async () => {
    tx.mobilePhoneEntryFlow.create.mockRejectedValue(new Error('database'));
    await expect(handler.execute({ phone })).rejects.toMatchObject({ status: 503 });
    expect(delivery.send).not.toHaveBeenCalled();
    expect(limiter.settle).toHaveBeenCalledWith('reservation', 'rejected');
  });
});
