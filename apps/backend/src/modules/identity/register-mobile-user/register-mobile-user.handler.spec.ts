import { Test } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { OtpChannel, OtpPurpose } from '@prisma/client';
import { RegisterMobileUserHandler } from './register-mobile-user.handler';
import { PrismaService } from '../../../infrastructure/database';
import { RequestOtpHandler } from '../otp/request-otp.handler';

const prismaMock = {
  user: { findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
};
const requestOtpMock = { execute: jest.fn() };

const PHONE = '+966500000000';
const pendingSelfSignup = {
  phone: PHONE,
  role: 'CLIENT',
  isActive: false,
  isSuperAdmin: false,
  phoneVerifiedAt: null,
  passwordHash: null,
};
const verifiedActive = {
  phone: PHONE,
  role: 'CLIENT',
  isActive: true,
  isSuperAdmin: false,
  phoneVerifiedAt: new Date('2026-09-01T00:00:00Z'),
  passwordHash: null,
};
const baseCmd = { firstName: 'Sara', lastName: 'Ahmad', phone: PHONE, email: 'sara@example.com' };

describe('RegisterMobileUserHandler', () => {
  let handler: RegisterMobileUserHandler;

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        RegisterMobileUserHandler,
        { provide: PrismaService, useValue: prismaMock },
        { provide: RequestOtpHandler, useValue: requestOtpMock },
      ],
    }).compile();
    handler = moduleRef.get(RegisterMobileUserHandler);
  });

  it('rejects when an existing user shares phone or email (generic message, no leak)', async () => {
    prismaMock.user.findMany.mockResolvedValue([{ id: 'u1', ...verifiedActive }]);
    await expect(
      handler.execute({ firstName: 'A', lastName: 'B', phone: '+966500000000', email: 'a@b.com' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('creates user with passwordHash null + phoneVerifiedAt null + isActive false, then triggers SMS OTP', async () => {
    prismaMock.user.findMany.mockResolvedValue([]);
    prismaMock.user.create.mockResolvedValue({ id: 'u2', phone: '+966500000000' });
    requestOtpMock.execute.mockResolvedValue({ success: true });

    const result = await handler.execute({
      firstName: 'A', lastName: 'B', phone: '+966500000000', email: 'a@b.com',
    });

    expect(prismaMock.user.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        passwordHash: null,
        phoneVerifiedAt: null,
        emailVerifiedAt: null,
        isActive: false,
      }),
    }));
    expect(requestOtpMock.execute).toHaveBeenCalledWith(expect.objectContaining({
      identifier: '+966500000000',
      channel: OtpChannel.SMS,
      purpose: OtpPurpose.MOBILE_REGISTER,
    }));
    expect(result.userId).toBe('u2');
    expect(result.maskedPhone).toMatch(/\*/);
  });

  it('normalizes input (lowercases email, strips whitespace from phone)', async () => {
    prismaMock.user.findMany.mockResolvedValue([]);
    prismaMock.user.create.mockResolvedValue({ id: 'u3', phone: '+966501234567' });
    requestOtpMock.execute.mockResolvedValue({ success: true });

    await handler.execute({
      firstName: 'A', lastName: 'B', phone: '+966 50 123 4567', email: 'A@B.com',
    });

    expect(prismaMock.user.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { OR: [{ phone: '+966501234567' }, { email: 'a@b.com' }] },
    }));
  });

  describe('retry of an unfinished self-signup', () => {
    it('re-sends the register OTP and updates names/email for a pending same-phone user (no conflict)', async () => {
      prismaMock.user.findMany.mockResolvedValue([{ id: 'pending-1', ...pendingSelfSignup }]);
      prismaMock.user.update.mockResolvedValue({ id: 'pending-1' });
      requestOtpMock.execute.mockResolvedValue({ success: true });

      const result = await handler.execute(baseCmd);

      expect(prismaMock.user.create).not.toHaveBeenCalled();
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: 'pending-1' },
        data: { firstName: 'Sara', lastName: 'Ahmad', name: 'Sara Ahmad', email: 'sara@example.com' },
      });
      expect(requestOtpMock.execute).toHaveBeenCalledWith({
        channel: OtpChannel.SMS,
        identifier: PHONE,
        purpose: OtpPurpose.MOBILE_REGISTER,
      });
      expect(result).toEqual({ userId: 'pending-1', maskedPhone: '+966***00' });
    });

    it('conflicts when the user is pending but the email belongs to another user', async () => {
      prismaMock.user.findMany.mockResolvedValue([
        { id: 'pending-1', ...pendingSelfSignup },
        { id: 'other', ...verifiedActive, phone: '+966511111111' },
      ]);

      await expect(handler.execute(baseCmd)).rejects.toBeInstanceOf(ConflictException);
      expect(prismaMock.user.update).not.toHaveBeenCalled();
      expect(requestOtpMock.execute).not.toHaveBeenCalled();
    });

    it('conflicts for a verified/active user with the same phone', async () => {
      prismaMock.user.findMany.mockResolvedValue([{ id: 'u1', ...verifiedActive }]);

      await expect(handler.execute(baseCmd)).rejects.toBeInstanceOf(ConflictException);
      expect(prismaMock.user.update).not.toHaveBeenCalled();
      expect(requestOtpMock.execute).not.toHaveBeenCalled();
    });

    it.each([
      ['active but unverified', { isActive: true }],
      ['phone verified', { phoneVerifiedAt: new Date() }],
      ['has a password', { passwordHash: 'hash' }],
      ['staff role', { role: 'RECEPTIONIST' }],
      ['super admin', { isSuperAdmin: true }],
    ])('conflicts when the matched user is not a pending self-signup (%s)', async (_label, override) => {
      prismaMock.user.findMany.mockResolvedValue([{ id: 'u1', ...pendingSelfSignup, ...override }]);

      await expect(handler.execute(baseCmd)).rejects.toBeInstanceOf(ConflictException);
      expect(prismaMock.user.update).not.toHaveBeenCalled();
      expect(requestOtpMock.execute).not.toHaveBeenCalled();
    });

    it('conflicts when a pending user matches by email only with a different phone', async () => {
      prismaMock.user.findMany.mockResolvedValue([
        { id: 'pending-2', ...pendingSelfSignup, phone: '+966522222222' },
      ]);

      await expect(handler.execute(baseCmd)).rejects.toBeInstanceOf(ConflictException);
      expect(prismaMock.user.update).not.toHaveBeenCalled();
      expect(requestOtpMock.execute).not.toHaveBeenCalled();
    });
  });
});
