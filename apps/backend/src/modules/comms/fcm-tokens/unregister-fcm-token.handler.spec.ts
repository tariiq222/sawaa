import { UnregisterFcmTokenHandler } from './unregister-fcm-token.handler';

describe('UnregisterFcmTokenHandler', () => {
  let prisma: { fcmToken: { deleteMany: jest.Mock } };
  let handler: UnregisterFcmTokenHandler;

  beforeEach(() => {
    prisma = { fcmToken: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) } };
    handler = new UnregisterFcmTokenHandler(prisma as never);
  });

  it('deletes a specific token when provided', async () => {
    const res = await handler.execute({ clientId: 'c1', token: 'tok-A' });
    expect(prisma.fcmToken.deleteMany).toHaveBeenCalledWith({
      where: { clientId: 'c1', token: 'tok-A' },
    });
    expect(res).toEqual({ deleted: 1 });
  });

  it('deletes all tokens for the client when no token provided', async () => {
    await handler.execute({ clientId: 'c1' });
    expect(prisma.fcmToken.deleteMany).toHaveBeenCalledWith({ where: { clientId: 'c1' } });
  });
});
