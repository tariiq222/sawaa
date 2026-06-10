import { Test } from '@nestjs/testing';
import { OtpChannel, OtpPurpose } from '@prisma/client';
import { RequestMobileLoginOtpHandler } from './request-mobile-login-otp.handler';
import { PrismaService } from '../../../infrastructure/database';
import { RequestOtpHandler } from '../otp/request-otp.handler';

const prismaMock = { user: { findFirst: jest.fn() } };
const requestOtpMock = { execute: jest.fn() };

describe('RequestMobileLoginOtpHandler', () => {
  let handler: RequestMobileLoginOtpHandler;

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        RequestMobileLoginOtpHandler,
        { provide: PrismaService, useValue: prismaMock },
        { provide: RequestOtpHandler, useValue: requestOtpMock },
      ],
    }).compile();
    handler = moduleRef.get(RequestMobileLoginOtpHandler);
  });

  it('returns generic response for unknown phone (no enumeration, no OTP issued)', async () => {
    prismaMock.user.findFirst.mockResolvedValue(null);
    const result = await handler.execute({ identifier: '+966500000000' });
    expect(result.maskedIdentifier).toBeDefined();
    expect(requestOtpMock.execute).not.toHaveBeenCalled();
  });

  it('does not issue OTP when phone unverified', async () => {
    prismaMock.user.findFirst.mockResolvedValue({
      id: 'u1',
      phone: '+966500000000',
      email: 'a@b.com',
      phoneVerifiedAt: null,
      emailVerifiedAt: null,
    });
    await handler.execute({ identifier: '+966500000000' });
    expect(requestOtpMock.execute).not.toHaveBeenCalled();
  });

  it('issues SMS OTP with MOBILE_LOGIN purpose when phone verified', async () => {
    prismaMock.user.findFirst.mockResolvedValue({
      id: 'u1',
      phone: '+966500000000',
      email: 'a@b.com',
      phoneVerifiedAt: new Date(),
      emailVerifiedAt: null,
    });
    await handler.execute({ identifier: '+966500000000' });
    expect(requestOtpMock.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        identifier: '+966500000000',
        channel: OtpChannel.SMS,
        purpose: OtpPurpose.MOBILE_LOGIN,
      }),
    );
  });

  it('does not issue email OTP when email unverified', async () => {
    prismaMock.user.findFirst.mockResolvedValue({
      id: 'u1',
      phone: '+966500000000',
      email: 'a@b.com',
      phoneVerifiedAt: new Date(),
      emailVerifiedAt: null,
    });
    await handler.execute({ identifier: 'a@b.com' });
    expect(requestOtpMock.execute).not.toHaveBeenCalled();
  });

  it('issues email OTP when email verified', async () => {
    prismaMock.user.findFirst.mockResolvedValue({
      id: 'u1',
      phone: '+966500000000',
      email: 'a@b.com',
      phoneVerifiedAt: new Date(),
      emailVerifiedAt: new Date(),
    });
    await handler.execute({ identifier: 'a@b.com' });
    expect(requestOtpMock.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        identifier: 'a@b.com',
        channel: OtpChannel.EMAIL,
        purpose: OtpPurpose.MOBILE_LOGIN,
      }),
    );
  });

  it('returns masked identifier shape for both channels', async () => {
    prismaMock.user.findFirst.mockResolvedValue(null);
    const phoneResult = await handler.execute({ identifier: '+966501234567' });
    expect(phoneResult.maskedIdentifier).toMatch(/\*/);
    const emailResult = await handler.execute({ identifier: 'someone@example.com' });
    expect(emailResult.maskedIdentifier).toContain('@');
    expect(emailResult.maskedIdentifier).toMatch(/\*/);
  });
});
