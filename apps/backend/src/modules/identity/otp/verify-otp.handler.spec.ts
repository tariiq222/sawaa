import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import * as bcrypt from 'bcryptjs';
import { VerifyOtpHandler } from './verify-otp.handler';
import { PrismaService } from '../../../infrastructure/database';
import { OtpSessionService } from './otp-session.service';
import { SINGLE_TENANT_CONTEXT_ID } from '../../../common/constants';

jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
}));

describe('VerifyOtpHandler', () => {
  let handler: VerifyOtpHandler;
  let prisma: any;
  let otpSession: jest.Mocked<Partial<OtpSessionService>>;
  let cls: jest.Mocked<Partial<ClsService>>;

  beforeEach(async () => {
    prisma = {
      otpCode: { findFirst: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
      client: { updateMany: jest.fn() },
    };
    otpSession = { signSession: jest.fn().mockResolvedValue('token-123') };
    cls = {
      run: jest.fn().mockImplementation((fn: any) => fn()),
      set: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VerifyOtpHandler,
        { provide: PrismaService, useValue: prisma },
        { provide: OtpSessionService, useValue: otpSession },
        { provide: ClsService, useValue: cls },
      ],
    }).compile();

    handler = module.get<VerifyOtpHandler>(VerifyOtpHandler);
  });

  const otpRecord = {
    id: 'otp-1',
    identifier: '+966500000001',
    purpose: 'CLIENT_LOGIN' as any,
    codeHash: 'hash',
    consumedAt: null,
    expiresAt: new Date(Date.now() + 60000),
    lockedUntil: null,
    attempts: 0,
    maxAttempts: 5,
    channel: 'SMS',
  };

  it('should throw BadRequestException when OTP not found', async () => {
    prisma.otpCode.findFirst.mockResolvedValue(null);
    await expect(handler.execute({ identifier: '+966500000001', code: '123456', purpose: 'CLIENT_LOGIN' } as any)).rejects.toThrow(BadRequestException);
  });

  it('should throw BadRequestException when OTP locked out', async () => {
    prisma.otpCode.findFirst.mockResolvedValue({ ...otpRecord, lockedUntil: new Date(Date.now() + 60000) });
    await expect(handler.execute({ identifier: '+966500000001', code: '123456', purpose: 'CLIENT_LOGIN' } as any)).rejects.toThrow('OTP_LOCKED_OUT');
  });

  it('should throw BadRequestException when max attempts reached', async () => {
    prisma.otpCode.findFirst.mockResolvedValue({ ...otpRecord, attempts: 5 });
    await expect(handler.execute({ identifier: '+966500000001', code: '123456', purpose: 'CLIENT_LOGIN' } as any)).rejects.toThrow('Too many failed attempts');
  });

  it('should throw UnauthorizedException when code does not match', async () => {
    prisma.otpCode.findFirst.mockResolvedValue(otpRecord);
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);
    prisma.otpCode.update.mockResolvedValue({});

    await expect(handler.execute({ identifier: '+966500000001', code: '123456', purpose: 'CLIENT_LOGIN' } as any)).rejects.toThrow(UnauthorizedException);
    expect(prisma.otpCode.update).toHaveBeenCalledWith(expect.objectContaining({ data: { attempts: { increment: 1 } } }));
    // below maxAttempts → no lockedUntil set
    expect(prisma.otpCode.update.mock.calls[0][0].data).not.toHaveProperty('lockedUntil');
  });

  it('sets lockedUntil when the failing attempt reaches maxAttempts', async () => {
    prisma.otpCode.findFirst.mockResolvedValue({ ...otpRecord, attempts: 4, maxAttempts: 5 });
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);
    prisma.otpCode.update.mockResolvedValue({});

    await expect(handler.execute({ identifier: '+966500000001', code: '000000', purpose: 'CLIENT_LOGIN' } as any)).rejects.toThrow(UnauthorizedException);
    const data = prisma.otpCode.update.mock.calls[0][0].data;
    expect(data.attempts).toEqual({ increment: 1 });
    expect(data.lockedUntil).toBeInstanceOf(Date);
    expect(data.lockedUntil.getTime()).toBeGreaterThan(Date.now());
  });

  it('should throw BadRequestException when already consumed during verify', async () => {
    prisma.otpCode.findFirst.mockResolvedValue(otpRecord);
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    prisma.otpCode.updateMany.mockResolvedValue({ count: 0 });

    await expect(handler.execute({ identifier: '+966500000001', code: '123456', purpose: 'CLIENT_LOGIN' } as any)).rejects.toThrow('OTP already used or expired');
  });

  it('should verify SMS OTP and return session token', async () => {
    prisma.otpCode.findFirst.mockResolvedValue(otpRecord);
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    prisma.otpCode.updateMany.mockResolvedValue({ count: 1 });
    prisma.client.updateMany.mockResolvedValue({});

    const result = await handler.execute({ identifier: '+966500000001', code: '123456', purpose: 'CLIENT_LOGIN' } as any);
    expect(prisma.client.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { phone: '+966500000001' },
      data: { phoneVerified: expect.any(Date) },
    }));
    expect(otpSession.signSession).toHaveBeenCalled();
    expect(otpSession.signSession).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: SINGLE_TENANT_CONTEXT_ID }),
    );
    expect(result.sessionToken).toBe('token-123');
  });

  it('should verify EMAIL OTP and mark email verified', async () => {
    prisma.otpCode.findFirst.mockResolvedValue({ ...otpRecord, channel: 'EMAIL' });
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    prisma.otpCode.updateMany.mockResolvedValue({ count: 1 });
    prisma.client.updateMany.mockResolvedValue({});

    await handler.execute({ identifier: 'test@test.com', code: '123456', purpose: 'CLIENT_LOGIN' } as any);
    expect(prisma.client.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { email: 'test@test.com' },
      data: { emailVerified: expect.any(Date) },
    }));
  });

  it('should skip client update for non-SMS non-EMAIL channels', async () => {
    prisma.otpCode.findFirst.mockResolvedValue({ ...otpRecord, channel: 'WHATSAPP' });
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    prisma.otpCode.updateMany.mockResolvedValue({ count: 1 });

    await handler.execute({ identifier: '+966500000001', code: '123456', purpose: 'CLIENT_LOGIN' } as any);
    expect(prisma.client.updateMany).not.toHaveBeenCalled();
  });
});
