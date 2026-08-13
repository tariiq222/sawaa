import { PrismaService } from '../../../../infrastructure/database';
import { Logger } from '@nestjs/common';
import { AdministrativeAssistantLeaseService } from './administrative-assistant-lease.service';

describe('AdministrativeAssistantLeaseService', () => {
  let prisma: { $queryRaw: jest.Mock; $executeRaw: jest.Mock };
  let lease: AdministrativeAssistantLeaseService;

  beforeAll(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    prisma = { $queryRaw: jest.fn(), $executeRaw: jest.fn() };
    lease = new AdministrativeAssistantLeaseService(prisma as unknown as PrismaService);
  });

  it('acquires a stored lease atomically when it is free or expired', async () => {
    prisma.$queryRaw.mockResolvedValue([{ id: 'conversation-1' }]);

    await expect(lease.acquire('conversation-1', 'worker-1', 7)).resolves.toBe(true);

    const [strings, owner, expiresAt, conversationId] = prisma.$queryRaw.mock.calls[0];
    expect(strings.join(' ')).toContain('UPDATE "ChatConversation"');
    expect(strings.join(' ')).toContain('"assistantLeaseExpiresAt" < now()');
    expect(strings.join(' ')).toContain('RETURNING "id"');
    expect(strings.join(' ')).toContain('"stateVersion" =');
    expect(conversationId).toBe('conversation-1');
    expect(owner).toBe('worker-1');
    expect(expiresAt).toBeInstanceOf(Date);
  });

  it('returns false while another unexpired owner holds the lease', async () => {
    prisma.$queryRaw.mockResolvedValue([]);

    await expect(lease.acquire('conversation-1', 'worker-2', 7)).resolves.toBe(false);
  });

  it('releases only the caller-owned lease and clears both stored fields', async () => {
    prisma.$executeRaw.mockResolvedValue(1);

    await lease.release('conversation-1', 'worker-1');

    const [strings, conversationId, owner] = prisma.$executeRaw.mock.calls[0];
    expect(strings.join(' ')).toContain('"assistantLeaseOwner" = NULL');
    expect(strings.join(' ')).toContain('"assistantLeaseExpiresAt" = NULL');
    expect(strings.join(' ')).toContain('"assistantLeaseOwner" =');
    expect(conversationId).toBe('conversation-1');
    expect(owner).toBe('worker-1');
  });

  it('renews only an owned unexpired lease', async () => {
    prisma.$queryRaw.mockResolvedValue([{ id: 'conversation-1' }]);

    await expect(lease.renew('conversation-1', 'worker-1', 7)).resolves.toBe(true);

    const [strings, expiresAt, conversationId, owner] = prisma.$queryRaw.mock.calls[0];
    expect(strings.join(' ')).toContain('"assistantLeaseExpiresAt" > now()');
    expect(strings.join(' ')).toContain('"stateVersion" =');
    expect(expiresAt).toBeInstanceOf(Date);
    expect(conversationId).toBe('conversation-1');
    expect(owner).toBe('worker-1');
  });

  it('does not leak a release failure out of finally paths', async () => {
    prisma.$executeRaw.mockRejectedValue(new Error('database unavailable'));

    await expect(lease.release('conversation-1', 'worker-1')).resolves.toBeUndefined();
  });
});
