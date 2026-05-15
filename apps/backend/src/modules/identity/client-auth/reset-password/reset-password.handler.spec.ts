import { Test } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { OtpPurpose, OtpChannel } from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/database';
import { OtpSessionService } from '../../otp/otp-session.service';
import { PasswordService } from '../../shared/password.service';
import { PasswordHistoryService } from '../shared/password-history.service';
import { ResetPasswordHandler } from './reset-password.handler';

jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
}));

describe('ResetPasswordHandler', () => {
  let handler: ResetPasswordHandler;
  let prisma: any;
  let otpSession: any;
  let passwords: any;
  let passwordHistory: any;

  beforeEach(async () => {
    prisma = {
      client: { findFirst: jest.fn(), update: jest.fn() },
      $transaction: jest.fn(async (cb) => await cb(prisma)),
      usedOtpSession: { create: jest.fn() },
      clientRefreshToken: { updateMany: jest.fn() },
    };
    otpSession = { verifySession: jest.fn() };
    passwords = { hash: jest.fn() };
    passwordHistory = { assertNotReused: jest.fn(), record: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        ResetPasswordHandler,
        { provide: PrismaService, useValue: prisma },
        { provide: OtpSessionService, useValue: otpSession },
        { provide: PasswordService, useValue: passwords },
        { provide: PasswordHistoryService, useValue: passwordHistory },
      ],
    }).compile();

    handler = module.get(ResetPasswordHandler);
  });

  it('should be defined', () => expect(handler).toBeDefined());

  it('should throw when session is null', async () => {
    otpSession.verifySession.mockReturnValue(null);
    await expect(handler.execute({ sessionToken: 't', newPassword: 'p' })).rejects.toThrow(UnauthorizedException);
  });

  it('should throw when purpose mismatch', async () => {
    otpSession.verifySession.mockReturnValue({ purpose: OtpPurpose.CLIENT_LOGIN });
    await expect(handler.execute({ sessionToken: 't', newPassword: 'p' })).rejects.toThrow(UnauthorizedException);
  });

  it('should throw when client not found for email', async () => {
    otpSession.verifySession.mockReturnValue({ purpose: OtpPurpose.CLIENT_PASSWORD_RESET, channel: OtpChannel.EMAIL, identifier: 'a@b.com', jti: 'j1' });
    prisma.client.findFirst.mockResolvedValue(null);
    await expect(handler.execute({ sessionToken: 't', newPassword: 'p' })).rejects.toThrow(UnauthorizedException);
  });

  it('should throw when client not found for phone', async () => {
    otpSession.verifySession.mockReturnValue({ purpose: OtpPurpose.CLIENT_PASSWORD_RESET, channel: OtpChannel.SMS, identifier: '+966501234567', jti: 'j1' });
    prisma.client.findFirst.mockResolvedValue(null);
    await expect(handler.execute({ sessionToken: 't', newPassword: 'p' })).rejects.toThrow(UnauthorizedException);
  });

  it('should throw when session already used', async () => {
    otpSession.verifySession.mockReturnValue({ purpose: OtpPurpose.CLIENT_PASSWORD_RESET, channel: OtpChannel.EMAIL, identifier: 'a@b.com', jti: 'j1', exp: Math.floor(Date.now() / 1000) + 3600 });
    prisma.client.findFirst.mockResolvedValue({ id: 'c1', passwordHash: 'old' });
    prisma.usedOtpSession.create.mockRejectedValue(new Error('dup'));
    await expect(handler.execute({ sessionToken: 't', newPassword: 'p' })).rejects.toThrow(UnauthorizedException);
  });

  it('should complete reset for email channel', async () => {
    const session = { purpose: OtpPurpose.CLIENT_PASSWORD_RESET, channel: OtpChannel.EMAIL, identifier: 'a@b.com', jti: 'j1', exp: Math.floor(Date.now() / 1000) + 3600 };
    otpSession.verifySession.mockReturnValue(session);
    prisma.client.findFirst.mockResolvedValue({ id: 'c1', passwordHash: 'old' });
    passwords.hash.mockResolvedValue('newHash');
    prisma.usedOtpSession.create.mockResolvedValue({});
    prisma.client.update.mockResolvedValue({});
    prisma.clientRefreshToken.updateMany.mockResolvedValue({ count: 2 });

    await handler.execute({ sessionToken: 't', newPassword: 'p' });
    expect(passwordHistory.assertNotReused).toHaveBeenCalledWith('c1', expect.any(String), 'p', 'old');
    expect(passwords.hash).toHaveBeenCalledWith('p');
    expect(prisma.client.update).toHaveBeenCalledWith({ where: { id: 'c1' }, data: { passwordHash: 'newHash', loginAttempts: 0, lockoutUntil: null } });
    expect(passwordHistory.record).toHaveBeenCalledWith(prisma, 'c1', expect.any(String), 'newHash');
    expect(prisma.clientRefreshToken.updateMany).toHaveBeenCalledWith({ where: { clientId: 'c1', revokedAt: null }, data: { revokedAt: expect.any(Date) } });
  });

  it('should complete reset for phone channel', async () => {
    const session = { purpose: OtpPurpose.CLIENT_PASSWORD_RESET, channel: OtpChannel.SMS, identifier: '+966501234567', jti: 'j1' };
    otpSession.verifySession.mockReturnValue(session);
    prisma.client.findFirst.mockResolvedValue({ id: 'c2', passwordHash: null });
    passwords.hash.mockResolvedValue('newHash');
    prisma.usedOtpSession.create.mockResolvedValue({});
    prisma.client.update.mockResolvedValue({});
    prisma.clientRefreshToken.updateMany.mockResolvedValue({ count: 1 });

    await handler.execute({ sessionToken: 't', newPassword: 'p' });
    expect(prisma.client.findFirst).toHaveBeenCalledWith({ where: { phone: '+966501234567', deletedAt: null } });
  });
});
