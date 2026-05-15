import { Test } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
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
    };
    clientTokens = { issueTokenPair: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        ClientRefreshHandler,
        { provide: PrismaService, useValue: prisma },
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
      { id: 't1', tokenHash: 'h1', tokenSelector: 'rawToken1' },
    ]);
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);
    await expect(handler.execute('rawToken123', 'c1')).rejects.toThrow(UnauthorizedException);
  });

  it('should throw when rotation race lost', async () => {
    prisma.clientRefreshToken.findMany.mockResolvedValue([
      { id: 't1', tokenHash: 'h1', tokenSelector: 'rawToken' },
    ]);
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    prisma.clientRefreshToken.updateMany.mockResolvedValue({ count: 0 });
    await expect(handler.execute('rawToken123', 'c1')).rejects.toThrow(UnauthorizedException);
  });

  it('should throw when client not found', async () => {
    prisma.clientRefreshToken.findMany.mockResolvedValue([
      { id: 't1', tokenHash: 'h1', tokenSelector: 'rawToken' },
    ]);
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    prisma.clientRefreshToken.updateMany.mockResolvedValue({ count: 1 });
    prisma.client.findFirst.mockResolvedValue(null);
    await expect(handler.execute('rawToken123', 'c1')).rejects.toThrow(UnauthorizedException);
  });

  it('should throw when client inactive', async () => {
    prisma.clientRefreshToken.findMany.mockResolvedValue([
      { id: 't1', tokenHash: 'h1', tokenSelector: 'rawToken' },
    ]);
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    prisma.clientRefreshToken.updateMany.mockResolvedValue({ count: 1 });
    prisma.client.findFirst.mockResolvedValue({ id: 'c1', isActive: false, deletedAt: null });
    await expect(handler.execute('rawToken123', 'c1')).rejects.toThrow(UnauthorizedException);
  });

  it('should throw when client deleted', async () => {
    prisma.clientRefreshToken.findMany.mockResolvedValue([
      { id: 't1', tokenHash: 'h1', tokenSelector: 'rawToken' },
    ]);
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    prisma.clientRefreshToken.updateMany.mockResolvedValue({ count: 1 });
    prisma.client.findFirst.mockResolvedValue({ id: 'c1', isActive: true, deletedAt: new Date() });
    await expect(handler.execute('rawToken123', 'c1')).rejects.toThrow(UnauthorizedException);
  });

  it('should return new tokens on success', async () => {
    prisma.clientRefreshToken.findMany.mockResolvedValue([
      { id: 't1', tokenHash: 'h1', tokenSelector: 'rawToken' },
    ]);
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    prisma.clientRefreshToken.updateMany.mockResolvedValue({ count: 1 });
    prisma.client.findFirst.mockResolvedValue({ id: 'c1', email: 'a@b.com', isActive: true, deletedAt: null });
    clientTokens.issueTokenPair.mockResolvedValue({ accessToken: 'at', rawRefresh: 'rt' });

    const result = await handler.execute('rawToken123', 'c1');
    expect(result.accessToken).toBe('at');
    expect(result.refreshToken).toBe('rt');
  });
});
