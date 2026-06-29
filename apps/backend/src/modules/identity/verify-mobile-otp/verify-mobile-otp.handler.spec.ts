import { Test } from '@nestjs/testing';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { ClsService } from 'nestjs-cls';
import { VerifyMobileOtpHandler } from './verify-mobile-otp.handler';
import { MobileOtpPurposeDto } from './verify-mobile-otp.dto';
import { PrismaService } from '../../../infrastructure/database';
import { TokenService } from '../shared/token.service';

const prismaMock = {
  user: { findFirst: jest.fn(), update: jest.fn() },
  otpCode: { findFirst: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
};
const tokensMock = { issueTokenPair: jest.fn() };
const clsMock = {
  run: jest.fn().mockImplementation((fn: () => unknown) => fn()),
  set: jest.fn(),
};

describe('VerifyMobileOtpHandler', () => {
  let handler: VerifyMobileOtpHandler;
  const goodCode = '123456';
  let goodCodeHash: string;

  beforeAll(async () => {
    goodCodeHash = await bcrypt.hash(goodCode, 4);
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    clsMock.run.mockImplementation((fn: () => unknown) => fn());
    const moduleRef = await Test.createTestingModule({
      providers: [
        VerifyMobileOtpHandler,
        { provide: PrismaService, useValue: prismaMock },
        { provide: TokenService, useValue: tokensMock },
        { provide: ClsService, useValue: clsMock },
      ],
    }).compile();
    handler = moduleRef.get(VerifyMobileOtpHandler);
  });

  it('throws UnauthorizedException when user not found', async () => {
    prismaMock.user.findFirst.mockResolvedValue(null);
    await expect(
      handler.execute({ identifier: '+966500000000', code: goodCode, purpose: MobileOtpPurposeDto.REGISTER }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('throws when no OTP record exists', async () => {
    prismaMock.user.findFirst.mockResolvedValue({
      id: 'u1',
      phone: '+966500000000',
      isActive: false,
      phoneVerifiedAt: null,
      customRole: null,
    });
    prismaMock.otpCode.findFirst.mockResolvedValue(null);
    await expect(
      handler.execute({ identifier: '+966500000000', code: goodCode, purpose: MobileOtpPurposeDto.REGISTER }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws when OTP expired', async () => {
    prismaMock.user.findFirst.mockResolvedValue({ id: 'u1', phone: '+966500000000', customRole: null });
    prismaMock.otpCode.findFirst.mockResolvedValue({
      id: 'o1',
      codeHash: goodCodeHash,
      expiresAt: new Date(Date.now() - 1000),
      attempts: 0,
      maxAttempts: 5,
      lockedUntil: null,
      consumedAt: null,
    });
    await expect(
      handler.execute({ identifier: '+966500000000', code: goodCode, purpose: MobileOtpPurposeDto.REGISTER }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws when OTP locked (attempts exhausted)', async () => {
    prismaMock.user.findFirst.mockResolvedValue({ id: 'u1', phone: '+966500000000', customRole: null });
    prismaMock.otpCode.findFirst.mockResolvedValue({
      id: 'o1',
      codeHash: goodCodeHash,
      expiresAt: new Date(Date.now() + 60000),
      attempts: 5,
      maxAttempts: 5,
      lockedUntil: new Date(Date.now() + 60000),
      consumedAt: null,
    });
    await expect(
      handler.execute({ identifier: '+966500000000', code: goodCode, purpose: MobileOtpPurposeDto.REGISTER }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws and increments attempts when code wrong', async () => {
    prismaMock.user.findFirst.mockResolvedValue({ id: 'u1', phone: '+966500000000', customRole: null });
    prismaMock.otpCode.findFirst.mockResolvedValue({
      id: 'o1',
      codeHash: goodCodeHash,
      expiresAt: new Date(Date.now() + 60000),
      attempts: 0,
      maxAttempts: 5,
      lockedUntil: null,
      consumedAt: null,
    });
    prismaMock.otpCode.update.mockResolvedValue({});

    await expect(
      handler.execute({ identifier: '+966500000000', code: '999999', purpose: MobileOtpPurposeDto.REGISTER }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(prismaMock.otpCode.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'o1' },
        data: expect.objectContaining({ attempts: { increment: 1 } }),
      }),
    );
  });

  it('register: marks consumed + sets phoneVerifiedAt + isActive + issues tokens', async () => {
    prismaMock.user.findFirst.mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      phone: '+966500000000',
      isActive: false,
      phoneVerifiedAt: null,
      customRoleId: null,
      customRole: null,
    });
    prismaMock.otpCode.findFirst.mockResolvedValue({
      id: 'o1',
      codeHash: goodCodeHash,
      expiresAt: new Date(Date.now() + 60000),
      attempts: 0,
      maxAttempts: 5,
      lockedUntil: null,
      consumedAt: null,
    });
    prismaMock.otpCode.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.user.update.mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      phone: '+966500000000',
      phoneVerifiedAt: new Date(),
      isActive: true,
      customRoleId: null,
      customRole: null,
    });
    tokensMock.issueTokenPair.mockResolvedValue({ accessToken: 'a', refreshToken: 'r' });

    const out = await handler.execute({
      identifier: '+966500000000',
      code: goodCode,
      purpose: MobileOtpPurposeDto.REGISTER,
    });

    expect(prismaMock.otpCode.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'o1',
          consumedAt: null,
          expiresAt: { gt: expect.any(Date) },
        }),
        data: expect.objectContaining({ consumedAt: expect.any(Date) }),
      }),
    );
    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'u1' },
        data: { phoneVerifiedAt: expect.any(Date), isActive: true },
      }),
    );
    expect(out.tokens.accessToken).toBe('a');
    // Result shape is tokens-only — guards against re-introducing SaaS fork fields.
    expect(Object.keys(out)).toEqual(['tokens']);
  });

  it('login: marks consumed + issues tokens', async () => {
    prismaMock.user.findFirst.mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      phone: '+966500000000',
      isActive: true,
      phoneVerifiedAt: new Date(),
      customRoleId: null,
      customRole: null,
    });
    prismaMock.otpCode.findFirst.mockResolvedValue({
      id: 'o1',
      codeHash: goodCodeHash,
      expiresAt: new Date(Date.now() + 60000),
      attempts: 0,
      maxAttempts: 5,
      lockedUntil: null,
      consumedAt: null,
    });
    prismaMock.otpCode.updateMany.mockResolvedValue({ count: 1 });
    tokensMock.issueTokenPair.mockResolvedValue({ accessToken: 'a', refreshToken: 'r' });

    const out = await handler.execute({
      identifier: '+966500000000',
      code: goodCode,
      purpose: MobileOtpPurposeDto.LOGIN,
    });

    expect(prismaMock.otpCode.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'o1',
          consumedAt: null,
          expiresAt: { gt: expect.any(Date) },
        }),
        data: expect.objectContaining({ consumedAt: expect.any(Date) }),
      }),
    );
    expect(out.tokens.accessToken).toBe('a');
    // Result shape is tokens-only — guards against re-introducing SaaS fork fields.
    expect(Object.keys(out)).toEqual(['tokens']);
  });

  it('login: throws UnauthorizedException when account inactive', async () => {
    prismaMock.user.findFirst.mockResolvedValue({
      id: 'u1',
      phone: '+966500000000',
      isActive: false,
      phoneVerifiedAt: new Date(),
      customRole: null,
    });
    prismaMock.otpCode.findFirst.mockResolvedValue({
      id: 'o1',
      codeHash: goodCodeHash,
      expiresAt: new Date(Date.now() + 60000),
      attempts: 0,
      maxAttempts: 5,
      lockedUntil: null,
      consumedAt: null,
    });
    prismaMock.otpCode.update.mockResolvedValue({});
    await expect(
      handler.execute({ identifier: '+966500000000', code: goodCode, purpose: MobileOtpPurposeDto.LOGIN }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('concurrent verify: second call fails — only one token pair is issued (no double-consume race)', async () => {
    // Both concurrent requests read the same still-unconsumed OTP record via
    // findFirst (the predicate races against the consume step), so the atomic
    // guard must live in the consume step, not the read.
    prismaMock.user.findFirst.mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      phone: '+966500000000',
      isActive: true,
      phoneVerifiedAt: new Date(),
      customRoleId: null,
      customRole: null,
    });
    prismaMock.otpCode.findFirst.mockResolvedValue({
      id: 'o1',
      codeHash: goodCodeHash,
      expiresAt: new Date(Date.now() + 60000),
      attempts: 0,
      maxAttempts: 5,
      lockedUntil: null,
      consumedAt: null,
    });
    // Simulate the DB-level atomic predicate: the first updateMany matches the
    // row (count 1), the second finds it already consumed (count 0).
    prismaMock.otpCode.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    tokensMock.issueTokenPair.mockResolvedValue({ accessToken: 'a', refreshToken: 'r' });

    const [first, second] = await Promise.allSettled([
      handler.execute({ identifier: '+966500000000', code: goodCode, purpose: MobileOtpPurposeDto.LOGIN }),
      handler.execute({ identifier: '+966500000000', code: goodCode, purpose: MobileOtpPurposeDto.LOGIN }),
    ]);

    expect(first.status).toBe('fulfilled');
    expect(second.status).toBe('rejected');
    if (second.status === 'rejected') {
      expect(second.reason).toBeInstanceOf(BadRequestException);
    }
    // The losing request must NOT receive a token pair.
    expect(tokensMock.issueTokenPair).toHaveBeenCalledTimes(1);
  });
});
