import { Test } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { createHash } from 'crypto';
import { PerformPasswordResetHandler } from './perform-password-reset.handler';
import { PrismaService, RlsTransactionService } from '../../../../infrastructure/database';
import { PasswordService } from '../../shared/password.service';

describe('PerformPasswordResetHandler', () => {
  let handler: PerformPasswordResetHandler;
  let prisma: {
    $transaction: jest.Mock;
    passwordResetToken: { findFirst: jest.Mock; update: jest.Mock };
    user: { update: jest.Mock; findUnique: jest.Mock };
    refreshToken: { updateMany: jest.Mock };
  };
  let passwords: { hash: jest.Mock; verify: jest.Mock };

  const rawToken = 'a'.repeat(64);
  const tokenHash = createHash('sha256').update(rawToken).digest('hex');

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn(prisma)),
      passwordResetToken: { findFirst: jest.fn(), update: jest.fn().mockResolvedValue({}) },
      user: { update: jest.fn().mockResolvedValue({}), findUnique: jest.fn().mockResolvedValue({ passwordHash: 'old' }) },
      refreshToken: { updateMany: jest.fn().mockResolvedValue({}) },
    };
    passwords = { hash: jest.fn().mockResolvedValue('hashed-pw'), verify: jest.fn().mockResolvedValue(false) };
    const moduleRef = await Test.createTestingModule({
      providers: [
        PerformPasswordResetHandler,
        { provide: PrismaService, useValue: prisma },
        { provide: RlsTransactionService, useValue: { withTransaction: jest.fn((cb: any) => cb(prisma)) } },
        { provide: PasswordService, useValue: passwords },
      ],
    }).compile();
    handler = moduleRef.get(PerformPasswordResetHandler);
  });

  it('throws when token does not exist', async () => {
    prisma.passwordResetToken.findFirst.mockResolvedValue(null);
    await expect(handler.execute({ token: rawToken, newPassword: 'newpass12' })).rejects.toThrow(UnauthorizedException);
  });

  it('throws when token is expired', async () => {
    prisma.passwordResetToken.findFirst.mockResolvedValue({
      id: 't1', userId: 'u1', tokenHash, expiresAt: new Date(Date.now() - 1000), consumedAt: null,
    });
    await expect(handler.execute({ token: rawToken, newPassword: 'newpass12' })).rejects.toThrow(UnauthorizedException);
  });

  it('throws when token already consumed', async () => {
    prisma.passwordResetToken.findFirst.mockResolvedValue({
      id: 't1', userId: 'u1', tokenHash, expiresAt: new Date(Date.now() + 60_000), consumedAt: new Date(),
    });
    await expect(handler.execute({ token: rawToken, newPassword: 'newpass12' })).rejects.toThrow(UnauthorizedException);
  });

  it('updates password, marks token consumed, revokes all refresh tokens', async () => {
    prisma.passwordResetToken.findFirst.mockResolvedValue({
      id: 't1', userId: 'u1', tokenHash, expiresAt: new Date(Date.now() + 60_000), consumedAt: null,
    });
    await handler.execute({ token: rawToken, newPassword: 'newpass12' });
    expect(passwords.hash).toHaveBeenCalledWith('newpass12');
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { passwordHash: 'hashed-pw', tokenVersion: { increment: 1 } },
    });
    expect(prisma.passwordResetToken.update).toHaveBeenCalledWith({ where: { id: 't1' }, data: { consumedAt: expect.any(Date) } });
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: 'u1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('bumps tokenVersion in the same user update that sets the new passwordHash', async () => {
    prisma.passwordResetToken.findFirst.mockResolvedValue({
      id: 't1', userId: 'u1', tokenHash, expiresAt: new Date(Date.now() + 60_000), consumedAt: null,
    });
    await handler.execute({ token: rawToken, newPassword: 'newpass12' });
    const updateArg = prisma.user.update.mock.calls[0][0];
    expect(updateArg.data.passwordHash).toBe('hashed-pw');
    expect(updateArg.data.tokenVersion).toEqual({ increment: 1 });
  });
});
