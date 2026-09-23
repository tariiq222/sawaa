import { RegisterFcmTokenHandler } from './register-fcm-token.handler';

describe('RegisterFcmTokenHandler', () => {
  const baseClient = { id: 'c1', organizationId: 'org1' };
  let prisma: {
    client: { findFirst: jest.Mock };
    fcmToken: { upsert: jest.Mock; deleteMany: jest.Mock };
    $queryRaw: jest.Mock;
    $executeRaw: jest.Mock;
  };
  let handler: RegisterFcmTokenHandler;

  beforeEach(() => {
    prisma = {
      client: { findFirst: jest.fn().mockResolvedValue(baseClient) },
      fcmToken: { upsert: jest.fn().mockResolvedValue({ id: 't1' }), deleteMany: jest.fn() },
      $queryRaw: jest.fn(),
      $executeRaw: jest.fn(),
    };
    handler = new RegisterFcmTokenHandler({ withTransaction: (fn: (tx: typeof prisma) => unknown) => fn(prisma) } as never);
  });

  it('upserts the (clientId, token) pair with current org', async () => {
    await handler.execute({ clientId: 'c1', token: 'tok-A', platform: 'ios' });
    expect(prisma.fcmToken.upsert).toHaveBeenCalledWith({
      where: { fcm_token_per_client: { clientId: 'c1', token: 'tok-A' } },
      create: {
        // org scoping moved to RLS / removed in single-tenant migration
        clientId: 'c1',
        token: 'tok-A',
        platform: 'ios',
      },
      update: { platform: 'ios', lastSeenAt: expect.any(Date) },
    });
  });

  it('requires an active account when checking registration ownership', async () => {
    await handler.execute({ clientId: 'c1', token: 'tok-A', platform: 'ios' });
    expect(prisma.client.findFirst).toHaveBeenCalledWith({ where: { id: 'c1', deletedAt: null, isActive: true }, select: { id: true } });
  });

  it('removes prior device ownership without removing other devices', async () => {
    await handler.execute({ clientId: 'c1', token: 'tok-A', platform: 'ios' });
    expect(prisma.fcmToken.deleteMany).toHaveBeenCalledWith({ where: { token: 'tok-A', clientId: { not: 'c1' } } });
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
  });

  it('throws when client does not exist', async () => {
    prisma.client.findFirst.mockResolvedValue(null);
    await expect(
      handler.execute({ clientId: 'c1', token: 'tok-A', platform: 'ios' }),
    ).rejects.toThrow(/Client not found/);
  });
});
