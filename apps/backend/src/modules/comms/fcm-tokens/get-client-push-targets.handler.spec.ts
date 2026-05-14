import { GetClientPushTargetsHandler } from './get-client-push-targets.handler';

describe('GetClientPushTargetsHandler', () => {
  let prisma: {
    client: { findFirst: jest.Mock };
    fcmToken: { findMany: jest.Mock };
  };
  let handler: GetClientPushTargetsHandler;

  beforeEach(() => {
    prisma = {
      client: { findFirst: jest.fn().mockResolvedValue({ id: 'c1', pushEnabled: true }) },
      fcmToken: { findMany: jest.fn().mockResolvedValue([{ token: 'a' }, { token: 'b' }]) },
    };
    handler = new GetClientPushTargetsHandler(prisma as never);
  });

  it('returns tokens when pushEnabled=true', async () => {
    const res = await handler.execute({ clientId: 'c1' });
    expect(res).toEqual({ pushEnabled: true, tokens: ['a', 'b'] });
  });

  it('returns empty tokens when pushEnabled=false', async () => {
    prisma.client.findFirst.mockResolvedValue({ id: 'c1', pushEnabled: false });
    const res = await handler.execute({ clientId: 'c1' });
    expect(res).toEqual({ pushEnabled: false, tokens: [] });
    expect(prisma.fcmToken.findMany).not.toHaveBeenCalled();
  });

  it('returns empty when client not found', async () => {
    prisma.client.findFirst.mockResolvedValue(null);
    const res = await handler.execute({ clientId: 'c1' });
    expect(res).toEqual({ pushEnabled: false, tokens: [] });
  });
});
