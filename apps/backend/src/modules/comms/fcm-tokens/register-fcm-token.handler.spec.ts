import { RegisterFcmTokenHandler } from './register-fcm-token.handler';

describe('RegisterFcmTokenHandler', () => {
  const baseClient = { id: 'c1', organizationId: 'org1' };
  let prisma: {
    client: { findFirst: jest.Mock };
    fcmToken: { upsert: jest.Mock };
  };
  let handler: RegisterFcmTokenHandler;

  beforeEach(() => {
    prisma = {
      client: { findFirst: jest.fn().mockResolvedValue(baseClient) },
      fcmToken: { upsert: jest.fn().mockResolvedValue({ id: 't1' }) },
    };
    handler = new RegisterFcmTokenHandler(prisma as never);
  });

  it('upserts the (clientId, token) pair with current org', async () => {
    await handler.execute({ clientId: 'c1', token: 'tok-A', platform: 'ios' });
    expect(prisma.fcmToken.upsert).toHaveBeenCalledWith({
      where: { fcm_token_per_client: { clientId: 'c1', token: 'tok-A' } },
      create: {
        organizationId: 'org1',
        clientId: 'c1',
        token: 'tok-A',
        platform: 'ios',
      },
      update: { platform: 'ios', lastSeenAt: expect.any(Date) },
    });
  });

  it('throws when client does not exist', async () => {
    prisma.client.findFirst.mockResolvedValue(null);
    await expect(
      handler.execute({ clientId: 'c1', token: 'tok-A', platform: 'ios' }),
    ).rejects.toThrow(/Client not found/);
  });
});
