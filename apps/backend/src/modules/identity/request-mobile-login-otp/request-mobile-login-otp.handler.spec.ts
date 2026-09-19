import { Test } from '@nestjs/testing';
import { OtpChannel, OtpPurpose } from '@prisma/client';
import { RequestMobileLoginOtpHandler } from './request-mobile-login-otp.handler';
import { PrismaService } from '../../../infrastructure/database';
import { RequestOtpHandler } from '../otp/request-otp.handler';

const prismaMock = { user: { findFirst: jest.fn() }, client: { findMany: jest.fn() } };
const requestOtpMock = { execute: jest.fn() };

describe('RequestMobileLoginOtpHandler', () => {
  let handler: RequestMobileLoginOtpHandler;

  beforeEach(async () => {
    jest.resetAllMocks();
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
      isActive: true,
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
      isActive: true,
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

  it('issues SMS OTP for an active verified legacy User CLIENT without a Client row', async () => {
    prismaMock.user.findFirst.mockResolvedValue({
      id: 'legacy-user', role: 'CLIENT', isActive: true, phoneVerifiedAt: new Date(), emailVerifiedAt: null,
    });
    prismaMock.client.findMany.mockResolvedValue([]);
    await handler.execute({ identifier: '+966500000000' });
    expect(requestOtpMock.execute).toHaveBeenCalledWith(expect.objectContaining({
      identifier: '+966500000000', purpose: OtpPurpose.MOBILE_LOGIN,
    }));
  });

  it('issues SMS OTP for an active Client-only customer with a verified phone', async () => {
    prismaMock.user.findFirst.mockResolvedValue(null);
    prismaMock.client.findMany.mockResolvedValue([{
      id: 'c-only', phone: '+966500000000', phoneVerified: new Date(), isActive: true, deletedAt: null,
    }]);
    await handler.execute({ identifier: '+966500000000' });
    expect(requestOtpMock.execute).toHaveBeenCalledWith(expect.objectContaining({
      identifier: '+966500000000', channel: OtpChannel.SMS, purpose: OtpPurpose.MOBILE_LOGIN,
    }));
  });

  it('issues SMS OTP for an active Client-only customer whose phone is not yet verified', async () => {
    prismaMock.user.findFirst.mockResolvedValue(null);
    prismaMock.client.findMany.mockResolvedValue([{
      id: 'c-only', phone: '+966500000000', phoneVerified: null, isActive: true, deletedAt: null,
    }]);
    await handler.execute({ identifier: '+966500000000' });
    expect(requestOtpMock.execute).toHaveBeenCalledWith(expect.objectContaining({ purpose: OtpPurpose.MOBILE_LOGIN }));
  });

  it('does not issue OTP when multiple Client rows share a phone', async () => {
    prismaMock.user.findFirst.mockResolvedValue(null);
    prismaMock.client.findMany.mockResolvedValue([{ id: 'c1' }, { id: 'c2' }]);
    await expect(handler.execute({ identifier: '+966500000000' })).rejects.toThrow(/conflict/i);
  });

  it('does not issue email OTP when email unverified', async () => {
    prismaMock.user.findFirst.mockResolvedValue({
      id: 'u1',
      isActive: true,
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
      isActive: true,
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

  it('issues email OTP for one active explicit CLIENT link', async () => {
    prismaMock.user.findFirst.mockResolvedValue({
      id: 'client-user', role: 'CLIENT', isActive: true, email: 'linked@example.com',
      emailVerifiedAt: new Date(), phoneVerifiedAt: new Date(),
    });
    prismaMock.client.findMany.mockResolvedValue([{
      id: 'linked-client', userId: 'client-user', isActive: true, deletedAt: null,
    }]);

    await handler.execute({ identifier: 'linked@example.com' });

    expect(requestOtpMock.execute).toHaveBeenCalledWith(expect.objectContaining({
      identifier: 'linked@example.com', channel: OtpChannel.EMAIL, purpose: OtpPurpose.MOBILE_LOGIN,
    }));
  });

  it('does not issue email OTP for an unlinked CLIENT User', async () => {
    prismaMock.user.findFirst.mockResolvedValue({
      id: 'unlinked-client-user', role: 'CLIENT', isActive: true, email: 'unlinked@example.com',
      emailVerifiedAt: new Date(), phoneVerifiedAt: new Date(),
    });
    prismaMock.client.findMany.mockResolvedValue([]);

    await handler.execute({ identifier: 'unlinked@example.com' });

    expect(requestOtpMock.execute).not.toHaveBeenCalled();
  });

  it('fails closed for ambiguous or inactive explicit CLIENT email links', async () => {
    prismaMock.user.findFirst.mockResolvedValue({
      id: 'ambiguous-client-user', role: 'CLIENT', isActive: true, email: 'ambiguous@example.com',
      emailVerifiedAt: new Date(), phoneVerifiedAt: new Date(),
    });
    prismaMock.client.findMany.mockResolvedValue([
      { id: 'inactive-client', userId: 'ambiguous-client-user', isActive: false, deletedAt: null },
      { id: 'second-client', userId: 'ambiguous-client-user', isActive: true, deletedAt: null },
    ]);

    await expect(handler.execute({ identifier: 'ambiguous@example.com' })).rejects.toThrow(/ambiguous or inactive/i);
    expect(requestOtpMock.execute).not.toHaveBeenCalled();
  });

  it('fails closed when another Client already owns the verified User email', async () => {
    prismaMock.user.findFirst.mockResolvedValue({
      id: 'linked-user', role: 'CLIENT', isActive: true, email: 'shared@example.com',
      emailVerifiedAt: new Date(), phoneVerifiedAt: new Date(),
    });
    prismaMock.client.findMany
      .mockResolvedValueOnce([{ id: 'linked-client', userId: 'linked-user', isActive: true, deletedAt: null }])
      .mockResolvedValueOnce([{ id: 'other-client', userId: 'other-user', isActive: true, deletedAt: null }]);

    await expect(handler.execute({ identifier: 'shared@example.com' })).rejects.toThrow(/email belongs to another customer/i);
    expect(requestOtpMock.execute).not.toHaveBeenCalled();
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
