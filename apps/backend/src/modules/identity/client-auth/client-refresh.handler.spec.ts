import { Test } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { ClientTokenService } from '../shared/client-token.service';
import { ClientRefreshHandler } from './client-refresh.handler';

jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
}));
import * as bcrypt from 'bcryptjs';

describe('ClientRefreshHandler', () => {
  let handler: ClientRefreshHandler;
  let prisma: any;
  let clientTokens: any;

  beforeEach(async () => {
    prisma = {
      clientRefreshToken: { findMany: jest.fn(), updateMany: jest.fn() },
      client: { findFirst: jest.fn() },
      // The handler locks the Client row inside the rotation transaction.
      $queryRaw: jest.fn().mockResolvedValue([]),
    };
    clientTokens = { issueTokenPair: jest.fn() };
    const rlsTransaction = {
      withTransaction: (callback: (tx: unknown) => unknown) => callback(prisma),
    };

    const module = await Test.createTestingModule({
      providers: [
        ClientRefreshHandler,
        { provide: PrismaService, useValue: prisma },
        { provide: RlsTransactionService, useValue: rlsTransaction },
        { provide: ClientTokenService, useValue: clientTokens },
      ],
    }).compile();

    handler = module.get(ClientRefreshHandler);
  });

  it('should be defined', () => expect(handler).toBeDefined());

  it('should throw when no candidates match', async () => {
    prisma.clientRefreshToken.findMany.mockResolvedValue([]);
    await expect(handler.execute('rawToken123', 'c1')).rejects.toThrow(UnauthorizedException);
  });

  it('should throw when hash does not match any candidate', async () => {
    prisma.clientRefreshToken.findMany.mockResolvedValue([
      { id: 't1', clientId: 'c1', tokenHash: 'h1', tokenSelector: 'rawToken1' },
    ]);
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);
    await expect(handler.execute('rawToken123', 'c1')).rejects.toThrow(UnauthorizedException);
  });

  it('should throw when rotation race lost', async () => {
    prisma.clientRefreshToken.findMany.mockResolvedValue([
      { id: 't1', clientId: 'c1', tokenHash: 'h1', tokenSelector: 'rawToken' },
    ]);
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    prisma.clientRefreshToken.updateMany.mockResolvedValue({ count: 0 });
    await expect(handler.execute('rawToken123', 'c1')).rejects.toThrow(UnauthorizedException);
  });

  it('should throw when client not found', async () => {
    prisma.clientRefreshToken.findMany.mockResolvedValue([
      { id: 't1', clientId: 'c1', tokenHash: 'h1', tokenSelector: 'rawToken' },
    ]);
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    prisma.clientRefreshToken.updateMany.mockResolvedValue({ count: 1 });
    prisma.client.findFirst.mockResolvedValue(null);
    await expect(handler.execute('rawToken123', 'c1')).rejects.toThrow(UnauthorizedException);
  });

  it('should throw when client inactive', async () => {
    prisma.clientRefreshToken.findMany.mockResolvedValue([
      { id: 't1', clientId: 'c1', tokenHash: 'h1', tokenSelector: 'rawToken' },
    ]);
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    prisma.clientRefreshToken.updateMany.mockResolvedValue({ count: 1 });
    prisma.client.findFirst.mockResolvedValue({ id: 'c1', isActive: false, deletedAt: null });
    await expect(handler.execute('rawToken123', 'c1')).rejects.toThrow(UnauthorizedException);
  });

  it('should throw when client deleted', async () => {
    prisma.clientRefreshToken.findMany.mockResolvedValue([
      { id: 't1', clientId: 'c1', tokenHash: 'h1', tokenSelector: 'rawToken' },
    ]);
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    prisma.clientRefreshToken.updateMany.mockResolvedValue({ count: 1 });
    prisma.client.findFirst.mockResolvedValue({ id: 'c1', isActive: true, deletedAt: new Date() });
    await expect(handler.execute('rawToken123', 'c1')).rejects.toThrow(UnauthorizedException);
  });

  it('should return new tokens on success', async () => {
    prisma.clientRefreshToken.findMany.mockResolvedValue([
      { id: 't1', clientId: 'c1', tokenHash: 'h1', tokenSelector: 'rawToken' },
    ]);
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    prisma.clientRefreshToken.updateMany.mockResolvedValue({ count: 1 });
    prisma.client.findFirst.mockResolvedValue({ id: 'c1', email: 'a@b.com', isActive: true, deletedAt: null, tokenVersion: 0 });
    clientTokens.issueTokenPair.mockResolvedValue({ accessToken: 'at', rawRefresh: 'rt' });

    const result = await handler.execute('rawToken123', 'c1');
    expect(result.accessToken).toBe('at');
    expect(result.refreshToken).toBe('rt');
  });

  // P1-7: refresh must carry the live tokenVersion so rotated access tokens are
  // not rejected by the strategy after a password reset bumped the version.
  it('passes the live tokenVersion through on refresh (P1-7)', async () => {
    prisma.clientRefreshToken.findMany.mockResolvedValue([
      { id: 't1', clientId: 'c1', tokenHash: 'h1', tokenSelector: 'rawToken' },
    ]);
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    prisma.clientRefreshToken.updateMany.mockResolvedValue({ count: 1 });
    prisma.client.findFirst.mockResolvedValue({ id: 'c1', email: 'a@b.com', isActive: true, deletedAt: null, tokenVersion: 3 });
    clientTokens.issueTokenPair.mockResolvedValue({ accessToken: 'at', rawRefresh: 'rt' });

    await handler.execute('rawToken123', 'c1');

    expect(clientTokens.issueTokenPair).toHaveBeenCalledWith({
      id: 'c1',
      email: 'a@b.com',
      tokenVersion: 3,
    }, { channel: 'web' }, prisma);
  });

  // SEC-AUTH-02: rotation, the session read, and the replacement insert must
  // share one transaction under the Client lock; otherwise a password reset can
  // land between the consume and the insert and the revoked session survives.
  it('locks the Client and rotates inside one transaction', async () => {
    prisma.clientRefreshToken.findMany.mockResolvedValue([
      { id: 't1', clientId: 'c1', tokenHash: 'h1', tokenSelector: 'rawToken' },
    ]);
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    prisma.clientRefreshToken.updateMany.mockResolvedValue({ count: 1 });
    prisma.client.findFirst.mockResolvedValue({ id: 'c1', email: 'a@b.com', isActive: true, deletedAt: null, tokenVersion: 3 });
    clientTokens.issueTokenPair.mockResolvedValue({ accessToken: 'at', rawRefresh: 'rt' });

    await handler.execute('rawToken123', 'c1');

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(prisma.clientRefreshToken.updateMany).toHaveBeenCalledWith({
      where: { id: 't1', revokedAt: null, expiresAt: { gt: expect.any(Date) } },
      data: { revokedAt: expect.any(Date) },
    });
    const lockOrder = prisma.$queryRaw.mock.invocationCallOrder[0];
    const consumeOrder = prisma.clientRefreshToken.updateMany.mock.invocationCallOrder[0];
    expect(lockOrder).toBeLessThan(consumeOrder);
  });
});
