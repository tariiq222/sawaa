import { Test } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { TokenService } from '../shared/token.service';
import { ClientTokenService } from '../shared/client-token.service';
import { NativeRefreshHandler } from './native-refresh.handler';
import { NativeLogoutHandler } from './native-logout.handler';
import { NativeSessionLookup } from './native-session.lookup';

jest.mock('bcryptjs', () => ({ compare: jest.fn() }));

const candidate = {
  id: 'refresh-1',
  userId: 'user-1',
  tokenHash: 'hash',
  tokenSelector: 'raw-toke',
  expiresAt: new Date(Date.now() + 60_000),
  revokedAt: null,
};

describe('native session handlers', () => {
  let refresh: NativeRefreshHandler;
  let logout: NativeLogoutHandler;
  let prisma: any;
  let tx: any;
  let rls: { withTransaction: jest.Mock };
  let tokens: { issueTokenPair: jest.Mock };
  let clientTokens: { issueTokenPair: jest.Mock };
  let lookup: NativeSessionLookup;

  beforeEach(async () => {
    prisma = {
      refreshToken: { findMany: jest.fn(), findFirst: jest.fn(), updateMany: jest.fn() },
      clientRefreshToken: { findMany: jest.fn(), findFirst: jest.fn(), updateMany: jest.fn() },
      user: { findUnique: jest.fn(), update: jest.fn() },
      client: { findUnique: jest.fn(), update: jest.fn() },
      fcmToken: { deleteMany: jest.fn() },
      $queryRaw: jest.fn(),
    };
    tx = prisma;
    rls = { withTransaction: jest.fn((callback) => callback(tx)) };
    tokens = { issueTokenPair: jest.fn() };
    clientTokens = { issueTokenPair: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        NativeSessionLookup,
        NativeRefreshHandler,
        NativeLogoutHandler,
        { provide: PrismaService, useValue: prisma },
        { provide: RlsTransactionService, useValue: rls },
        { provide: TokenService, useValue: tokens },
        { provide: ClientTokenService, useValue: clientTokens },
      ],
    }).compile();

    lookup = module.get(NativeSessionLookup);
    refresh = module.get(NativeRefreshHandler);
    logout = module.get(NativeLogoutHandler);
    jest.clearAllMocks();
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
  });

  it('rejects an unknown native refresh token without touching a user', async () => {
    prisma.refreshToken.findMany.mockResolvedValue([]);

    await expect(refresh.execute('unknown-refresh-token')).rejects.toThrow(UnauthorizedException);
    expect(rls.withTransaction).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('rotates a verified token while locking the user and issuing inside the transaction', async () => {
    prisma.refreshToken.findMany.mockResolvedValue([candidate]);
    prisma.user.findUnique.mockResolvedValue({
      ...candidate,
      id: 'user-1',
      email: 'staff@example.com',
      role: 'RECEPTIONIST',
      customRoleId: null,
      customRole: null,
      isActive: true,
      isSuperAdmin: false,
      tokenVersion: 4,
    });
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });
    tokens.issueTokenPair.mockResolvedValue({ accessToken: 'next-access', refreshToken: 'next-refresh' });

    await expect(refresh.execute('raw-token-value')).resolves.toEqual({
      accessToken: 'next-access',
      refreshToken: 'next-refresh',
    });
    expect(prisma.$queryRaw).toHaveBeenCalled();
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: candidate.id, revokedAt: null }),
      }),
    );
    expect(tokens.issueTokenPair).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'user-1', tokenVersion: 4 }),
      { isSuperAdmin: false },
      tx,
    );
  });

  it('rejects a replay that loses the conditional token-consume race', async () => {
    prisma.refreshToken.findMany.mockResolvedValue([candidate]);
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1', isActive: true });
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 0 });

    await expect(refresh.execute('raw-token-value')).rejects.toThrow(UnauthorizedException);
    expect(tokens.issueTokenPair).not.toHaveBeenCalled();
  });

  it('rejects an inactive user before consuming their refresh token', async () => {
    prisma.refreshToken.findMany.mockResolvedValue([candidate]);
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1', isActive: false });

    await expect(refresh.execute('raw-token-value')).rejects.toThrow(UnauthorizedException);
    expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
  });

  it('rejects a legacy User CLIENT refresh token instead of exchanging it into Client JWTs', async () => {
    prisma.refreshToken.findMany.mockResolvedValue([candidate]);
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1', role: 'CLIENT', isActive: true });

    await expect(refresh.execute('raw-token-value')).rejects.toThrow(UnauthorizedException);
    expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
    expect(clientTokens.issueTokenPair).not.toHaveBeenCalled();
  });

  it('lets issuance failure reject the transaction after the consume attempt', async () => {
    prisma.refreshToken.findMany.mockResolvedValue([candidate]);
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1', email: 'staff@example.com', role: 'RECEPTIONIST', customRoleId: null,
      customRole: null, isActive: true, isSuperAdmin: false, tokenVersion: 0,
    });
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });
    tokens.issueTokenPair.mockRejectedValue(new Error('database write failed'));

    await expect(refresh.execute('raw-token-value')).rejects.toThrow('database write failed');
    expect(rls.withTransaction).toHaveBeenCalledTimes(1);
  });

  it('revokes every active token and bumps tokenVersion for a valid logout', async () => {
    prisma.refreshToken.findMany.mockResolvedValue([candidate]);
    prisma.refreshToken.findFirst.mockResolvedValue(candidate);
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });
    prisma.user.update.mockResolvedValue({ id: 'user-1' });

    await expect(logout.execute('raw-token-value')).resolves.toBeUndefined();
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { tokenVersion: { increment: 1 } },
    });
  });

  it('does not bump the version when the token was consumed before the user lock', async () => {
    prisma.refreshToken.findMany.mockResolvedValue([candidate]);
    prisma.refreshToken.findFirst.mockResolvedValue(null);

    await expect(logout.execute('raw-token-value')).resolves.toBeUndefined();
    expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('does not let a revoked historical token log out a later session', async () => {
    prisma.refreshToken.findMany.mockResolvedValue([]);

    await expect(logout.execute('historical-refresh-token')).resolves.toBeUndefined();
    expect(rls.withTransaction).not.toHaveBeenCalled();
    expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('does not mutate arbitrary users for an invalid logout token', async () => {
    prisma.refreshToken.findMany.mockResolvedValue([]);

    await expect(logout.execute('invalid-token')).resolves.toBeUndefined();
    expect(rls.withTransaction).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('rotates a Client refresh token into the client namespace', async () => {
    const clientCandidate = {
      id: 'client-refresh-1', clientId: 'client-1', tokenHash: 'hash',
      tokenSelector: 'raw-toke', expiresAt: new Date(Date.now() + 60_000), revokedAt: null,
    };
    prisma.clientRefreshToken.findMany.mockResolvedValue([clientCandidate]);
    prisma.client.findUnique.mockResolvedValue({
      id: 'client-1', email: 'client@example.com', phone: '+966500000000',
      isActive: true, deletedAt: null, tokenVersion: 3,
    });
    prisma.clientRefreshToken.updateMany.mockResolvedValue({ count: 1 });
    clientTokens.issueTokenPair.mockResolvedValue({ accessToken: 'client-access', rawRefresh: 'client-next' });

    await expect(refresh.execute('raw-token-value')).resolves.toEqual({
      accessToken: 'client-access', refreshToken: 'client-next',
    });
    expect(tokens.issueTokenPair).not.toHaveBeenCalled();
    expect(clientTokens.issueTokenPair).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'client-1', tokenVersion: 3 }), tx,
    );
  });

  it('revokes all active Client refresh tokens and bumps the Client version on logout', async () => {
    const clientCandidate = {
      id: 'client-refresh-1', clientId: 'client-1', tokenHash: 'hash',
      tokenSelector: 'raw-toke', expiresAt: new Date(Date.now() + 60_000), revokedAt: null,
    };
    prisma.clientRefreshToken.findMany.mockResolvedValue([clientCandidate]);
    prisma.clientRefreshToken.findFirst.mockResolvedValue(clientCandidate);
    prisma.clientRefreshToken.updateMany.mockResolvedValue({ count: 1 });
    prisma.client.update.mockResolvedValue({ id: 'client-1' });
    prisma.fcmToken.deleteMany.mockResolvedValue({ count: 1 });

    await expect(logout.execute('raw-token-value')).resolves.toBeUndefined();
    expect(prisma.clientRefreshToken.updateMany).toHaveBeenCalledWith({
      where: { clientId: 'client-1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    expect(prisma.client.update).toHaveBeenCalledWith({
      where: { id: 'client-1' }, data: { tokenVersion: { increment: 1 } },
    });
    expect(prisma.fcmToken.deleteMany).toHaveBeenCalledWith({ where: { clientId: 'client-1' } });
  });
});
