import { RequestClientPhoneHandler } from './request-client-phone.handler';
import { EmailEntryDeliveryError } from '../mobile-email-entry/mobile-email-delivery';

describe('RequestClientPhoneHandler', () => {
  const phone = '+966512345678';
  let tx: any, store: any, limiter: any, delivery: any, handler: RequestClientPhoneHandler, open: number;
  beforeEach(() => {
    open = 0;
    tx = {
      user: { findFirst: jest.fn() },
      client: { findFirst: jest.fn() },
      clientPhoneChallenge: { updateMany: jest.fn(async () => ({ count: 0 })), create: jest.fn(async ({ data }: any) => ({ id: 'challenge', ...data })) },
    };
    store = {
      transaction: jest.fn(async (run: any) => { open++; try { return await run(tx); } finally { open--; } }),
      owner: jest.fn(async () => ({ id: 'client-1', phone: '+966500000001' })),
    };
    limiter = { reserve: jest.fn(async (_channel: string, key: string) => `reservation:${key}`), settle: jest.fn() };
    delivery = { send: jest.fn(async () => { expect(open).toBe(0); }) };
    handler = new RequestClientPhoneHandler(store, limiter, delivery);
  });

  it('creates a challenge, sends the code to the NEW number outside any transaction and budgets actor + target', async () => {
    expect(await handler.execute('client-1', { phone })).toEqual({ challengeId: 'challenge', maskedPhone: '+966***78', expiresIn: 300, retryAfterSeconds: 60 });
    expect(delivery.send).toHaveBeenCalledWith('SMS', phone, expect.stringMatching(/^\d{6}$/));
    const data = tx.clientPhoneChallenge.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ clientId: 'client-1', phone, codeHash: expect.any(String) });
    expect(data.codeHash).not.toBe(delivery.send.mock.calls[0][2]);
    expect(tx.clientPhoneChallenge.updateMany).toHaveBeenCalledWith({ where: { clientId: 'client-1', consumedAt: null }, data: { consumedAt: expect.any(Date) } });
    expect(limiter.reserve).toHaveBeenCalledWith('SMS', 'client-phone:client-1');
    expect(limiter.reserve).toHaveBeenCalledWith('SMS', phone);
    expect(limiter.settle).toHaveBeenCalledWith(`reservation:${phone}`, 'accepted');
  });

  it('never looks up who owns the requested number (no enumeration)', async () => {
    await handler.execute('client-1', { phone });
    expect(tx.client.findFirst).not.toHaveBeenCalled();
    expect(tx.user.findFirst).not.toHaveBeenCalled();
  });

  it.each(['+14155550100', '+966112345678', 'garbage'])('rejects %s', async value => {
    await expect(handler.execute('client-1', { phone: value })).rejects.toMatchObject({ status: 400, response: { code: 'invalid_phone' } });
    expect(limiter.reserve).not.toHaveBeenCalled();
  });

  it('rejects the current number before spending any budget', async () => {
    store.owner.mockResolvedValue({ id: 'client-1', phone });
    await expect(handler.execute('client-1', { phone })).rejects.toMatchObject({ status: 400, response: { code: 'phone_unchanged' } });
    expect(limiter.reserve).not.toHaveBeenCalled();
    expect(delivery.send).not.toHaveBeenCalled();
  });

  it('voids the challenge and reports 503 when delivery fails', async () => {
    delivery.send.mockRejectedValue(new EmailEntryDeliveryError('rejected'));
    await expect(handler.execute('client-1', { phone })).rejects.toMatchObject({ status: 503, response: { code: 'delivery_unavailable' } });
    expect(tx.clientPhoneChallenge.updateMany).toHaveBeenLastCalledWith({ where: { id: 'challenge', consumedAt: null }, data: { consumedAt: expect.any(Date) } });
    expect(limiter.settle).toHaveBeenCalledWith(`reservation:${phone}`, 'rejected');
  });

  it('refunds the actor budget when the target is rate limited', async () => {
    limiter.reserve.mockImplementation(async (_channel: string, key: string) => {
      if (key === phone) throw Object.assign(new Error('limited'), { status: 429 });
      return `reservation:${key}`;
    });
    await expect(handler.execute('client-1', { phone })).rejects.toMatchObject({ status: 429 });
    expect(limiter.settle).toHaveBeenCalledWith('reservation:client-phone:client-1', 'rejected');
    expect(delivery.send).not.toHaveBeenCalled();
  });
});
