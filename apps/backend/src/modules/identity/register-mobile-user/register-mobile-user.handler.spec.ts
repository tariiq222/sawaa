import { Test } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { OtpChannel, OtpPurpose } from '@prisma/client';
import { RegisterMobileUserHandler } from './register-mobile-user.handler';
import { PrismaService } from '../../../infrastructure/database';
import { RequestOtpHandler } from '../otp/request-otp.handler';

const prismaMock = {
  user: { findFirst: jest.fn(), create: jest.fn() },
};
const requestOtpMock = { execute: jest.fn() };

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
    prismaMock.user.findFirst.mockResolvedValue({ id: 'u1' });
    await expect(
      handler.execute({ firstName: 'A', lastName: 'B', phone: '+966500000000', email: 'a@b.com' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('creates user with passwordHash null + phoneVerifiedAt null + isActive false, then triggers SMS OTP', async () => {
    prismaMock.user.findFirst.mockResolvedValue(null);
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
      hCaptchaToken: expect.any(String),
    }));
    expect(result.userId).toBe('u2');
    expect(result.maskedPhone).toMatch(/\*/);
  });

  it('normalizes input (lowercases email, strips whitespace from phone)', async () => {
    prismaMock.user.findFirst.mockResolvedValue(null);
    prismaMock.user.create.mockResolvedValue({ id: 'u3', phone: '+966501234567' });
    requestOtpMock.execute.mockResolvedValue({ success: true });

    await handler.execute({
      firstName: 'A', lastName: 'B', phone: '+966 50 123 4567', email: 'A@B.com',
    });

    expect(prismaMock.user.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { OR: [{ phone: '+966501234567' }, { email: 'a@b.com' }] },
    }));
  });
});
