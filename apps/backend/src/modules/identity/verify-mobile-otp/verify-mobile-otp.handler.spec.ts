import { Test } from '@nestjs/testing';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { ClsService } from 'nestjs-cls';
import { VerifyMobileOtpHandler } from './verify-mobile-otp.handler';
import { MobileOtpPurposeDto } from './verify-mobile-otp.dto';
import { PrismaService } from '../../../infrastructure/database';
import { TokenService } from '../shared/token.service';
import { ClientTokenService } from '../shared/client-token.service';
import { RlsTransactionService } from '../../../infrastructure/database';
import { PlatformSettingsService } from '../../platform/settings/platform-settings.service';

const prismaMock = {
  user: { findFirst: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
  client: { findMany: jest.fn(), findFirst: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
  otpCode: { findFirst: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
  employee: { findFirst: jest.fn() },
  $queryRaw: jest.fn(),
};
const tokensMock = { issueTokenPair: jest.fn() };
const clientTokensMock = { issueTokenPair: jest.fn() };
const rlsMock = { withTransaction: jest.fn((fn: (tx: typeof prismaMock) => unknown) => fn(prismaMock)) };
const settingsMock = { get: jest.fn() };
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
    prismaMock.client.findMany.mockReset();
    clsMock.run.mockImplementation((fn: () => unknown) => fn());
    settingsMock.get.mockResolvedValue(false);
    prismaMock.employee.findFirst.mockResolvedValue({ id: 'emp-1' });
    rlsMock.withTransaction.mockImplementation((fn: (tx: typeof prismaMock) => unknown) => fn(prismaMock));
    prismaMock.user.findUnique.mockImplementation(() => prismaMock.user.findFirst());
    prismaMock.client.findUnique.mockImplementation(async () => {
      const result = prismaMock.client.findMany.mock.results.at(-1)?.value;
      const rows = result ? await result : [];
      return rows?.[0] ?? null;
    });
    const moduleRef = await Test.createTestingModule({
      providers: [
        VerifyMobileOtpHandler,
        { provide: PrismaService, useValue: prismaMock },
        { provide: TokenService, useValue: tokensMock },
        { provide: ClientTokenService, useValue: clientTokensMock },
        { provide: RlsTransactionService, useValue: rlsMock },
        { provide: ClsService, useValue: clsMock },
        { provide: PlatformSettingsService, useValue: settingsMock },
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

  it('never activates or changes a staff account through mobile registration', async () => {
    prismaMock.user.findFirst.mockResolvedValue({ id: 'staff-1', role: 'RECEPTIONIST', phone: '+966500000000' });
    await expect(handler.execute({ identifier: '+966500000000', code: goodCode, purpose: MobileOtpPurposeDto.REGISTER }))
      .rejects.toBeInstanceOf(UnauthorizedException);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('does not reactivate an already verified disabled customer with a leftover register OTP', async () => {
    prismaMock.user.findFirst.mockResolvedValue({
      id: 'disabled-client', role: 'CLIENT', phone: '+966500000000', phoneVerifiedAt: new Date(), isActive: false,
    });
    await expect(handler.execute({ identifier: '+966500000000', code: goodCode, purpose: MobileOtpPurposeDto.REGISTER }))
      .rejects.toBeInstanceOf(UnauthorizedException);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('throws when no OTP record exists', async () => {
    prismaMock.user.findFirst.mockResolvedValue({
      id: 'u1',
      role: 'CLIENT',
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
    prismaMock.user.findFirst.mockResolvedValue({ id: 'u1', role: 'CLIENT', phone: '+966500000000', customRole: null });
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
    prismaMock.user.findFirst.mockResolvedValue({ id: 'u1', role: 'CLIENT', phone: '+966500000000', customRole: null });
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
    prismaMock.user.findFirst.mockResolvedValue({ id: 'u1', role: 'CLIENT', phone: '+966500000000', customRole: null });
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
      role: 'CLIENT',
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
    prismaMock.client.create.mockResolvedValue({
      id: 'c-new', userId: 'u1', email: null, phone: '+966500000000',
      isActive: true, deletedAt: null, phoneVerified: new Date(), tokenVersion: 0,
    });
    tokensMock.issueTokenPair.mockResolvedValue({ accessToken: 'a', refreshToken: 'r' });
    clientTokensMock.issueTokenPair.mockResolvedValue({ accessToken: 'a', rawRefresh: 'r' });

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
    expect(Object.keys(out)).toEqual(['tokens', 'sessionKind']);
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
    expect(Object.keys(out)).toEqual(['tokens', 'sessionKind']);
  });

  describe('staff mobile sign-in', () => {
    const staffUser = (isSuperAdmin: boolean) => ({
      id: 'u-staff', role: 'ADMIN', isSuperAdmin, email: 'admin@b.com', phone: '+966500000000',
      isActive: true, phoneVerifiedAt: new Date(), customRoleId: null, customRole: null,
    });
    const validOtp = () => ({
      id: 'o1', codeHash: goodCodeHash, expiresAt: new Date(Date.now() + 60000),
      attempts: 0, maxAttempts: 5, lockedUntil: null, consumedAt: null,
    });

    beforeEach(() => {
      prismaMock.otpCode.findFirst.mockResolvedValue(validOtp());
      prismaMock.otpCode.updateMany.mockResolvedValue({ count: 1 });
      tokensMock.issueTokenPair.mockResolvedValue({ accessToken: 'a', refreshToken: 'r' });
    });

    it('refuses a super-admin OTP-only login when two-factor is required, without touching the code', async () => {
      prismaMock.user.findFirst.mockResolvedValue(staffUser(true));
      settingsMock.get.mockResolvedValue(true);

      await expect(handler.execute({ identifier: '+966500000000', code: goodCode, purpose: MobileOtpPurposeDto.LOGIN }))
        .rejects.toBeInstanceOf(UnauthorizedException);
      expect(settingsMock.get).toHaveBeenCalledWith('security.twoFactor.required');
      expect(tokensMock.issueTokenPair).not.toHaveBeenCalled();
      expect(prismaMock.otpCode.updateMany).not.toHaveBeenCalled();
    });

    it('does not reveal staff eligibility for a wrong code', async () => {
      prismaMock.user.findFirst.mockResolvedValue(staffUser(false));
      prismaMock.employee.findFirst.mockResolvedValue(null);

      await expect(handler.execute({ identifier: '+966500000000', code: '9999', purpose: MobileOtpPurposeDto.LOGIN }))
        .rejects.toThrow('Invalid OTP code');
      expect(prismaMock.employee.findFirst).not.toHaveBeenCalled();
      expect(settingsMock.get).not.toHaveBeenCalled();
    });

    it('allows a super-admin when two-factor is not required', async () => {
      prismaMock.user.findFirst.mockResolvedValue(staffUser(true));
      settingsMock.get.mockResolvedValue(false);

      const out = await handler.execute({ identifier: '+966500000000', code: goodCode, purpose: MobileOtpPurposeDto.LOGIN });
      expect(out).toEqual({ tokens: { accessToken: 'a', refreshToken: 'r' }, sessionKind: 'staff' });
      expect(tokensMock.issueTokenPair).toHaveBeenCalledWith(expect.objectContaining({ id: 'u-staff' }), { isSuperAdmin: true }, prismaMock, 'MOBILE');
    });

    it('refuses staff without an active practitioner record, without touching the code', async () => {
      prismaMock.user.findFirst.mockResolvedValue(staffUser(false));
      prismaMock.employee.findFirst.mockResolvedValue(null);

      await expect(handler.execute({ identifier: '+966500000000', code: goodCode, purpose: MobileOtpPurposeDto.LOGIN }))
        .rejects.toBeInstanceOf(UnauthorizedException);
      expect(prismaMock.employee.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'u-staff', isActive: true } }));
      expect(tokensMock.issueTokenPair).not.toHaveBeenCalled();
      expect(prismaMock.otpCode.updateMany).not.toHaveBeenCalled();
    });

    it('allows a non-super-admin practitioner even when two-factor is required', async () => {
      prismaMock.user.findFirst.mockResolvedValue(staffUser(false));
      settingsMock.get.mockResolvedValue(true);

      const out = await handler.execute({ identifier: '+966500000000', code: goodCode, purpose: MobileOtpPurposeDto.LOGIN });
      expect(out).toEqual({ tokens: { accessToken: 'a', refreshToken: 'r' }, sessionKind: 'staff' });
    });
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

  it('login: resolves a linked CLIENT to Client JWT namespace', async () => {
    prismaMock.user.findFirst.mockResolvedValue({
      id: 'u-client', role: 'CLIENT', email: 'client@example.com', phone: '+966500000000',
      isActive: true, phoneVerifiedAt: new Date(), customRole: null, customRoleId: null,
    });
    prismaMock.client.findMany.mockResolvedValue([{
      id: 'c1', userId: 'u-client', email: 'client@example.com', phone: '+966500000000',
      isActive: true, deletedAt: null, phoneVerified: new Date(), tokenVersion: 2,
    }]);
    prismaMock.otpCode.findFirst.mockResolvedValue({
      id: 'o1', codeHash: goodCodeHash, expiresAt: new Date(Date.now() + 60000),
      attempts: 0, maxAttempts: 5, lockedUntil: null, consumedAt: null,
    });
    prismaMock.otpCode.updateMany.mockResolvedValue({ count: 1 });
    clientTokensMock.issueTokenPair.mockResolvedValue({ rawRefresh: 'r', accessToken: 'client-access' });

    const out = await handler.execute({ identifier: '+966500000000', code: goodCode, purpose: MobileOtpPurposeDto.LOGIN });

    expect(clientTokensMock.issueTokenPair).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'c1', tokenVersion: 2 }),
      prismaMock,
    );
    expect(tokensMock.issueTokenPair).not.toHaveBeenCalled();
    expect(out).toEqual({ tokens: { accessToken: 'client-access', refreshToken: 'r' }, sessionKind: 'client' });
  });

  it('login: allows the same unlinked Client matched by verified phone and email', async () => {
    const candidate = {
      id: 'same-client', userId: null, email: 'same@example.com', phone: '+966500000000',
      isActive: true, deletedAt: null, phoneVerified: new Date(), tokenVersion: 0,
    };
    prismaMock.user.findFirst.mockResolvedValue({
      id: 'same-user', role: 'CLIENT', email: 'same@example.com', phone: '+966500000000',
      isActive: true, phoneVerifiedAt: new Date(), customRole: null,
    });
    prismaMock.client.findMany
      .mockResolvedValueOnce([candidate])
      .mockResolvedValueOnce([candidate]);
    prismaMock.client.findUnique.mockResolvedValue(candidate);
    prismaMock.client.update.mockResolvedValue({ ...candidate, userId: 'same-user' });
    prismaMock.otpCode.findFirst.mockResolvedValue({
      id: 'o-same', codeHash: goodCodeHash, expiresAt: new Date(Date.now() + 60000),
      attempts: 0, maxAttempts: 5, lockedUntil: null, consumedAt: null,
    });
    prismaMock.otpCode.updateMany.mockResolvedValue({ count: 1 });
    clientTokensMock.issueTokenPair.mockResolvedValue({ accessToken: 'client-access', rawRefresh: 'r' });

    await expect(handler.execute({ identifier: '+966500000000', code: goodCode, purpose: MobileOtpPurposeDto.LOGIN }))
      .resolves.toEqual({ tokens: { accessToken: 'client-access', refreshToken: 'r' }, sessionKind: 'client' });
  });

  it('login: rejects a distinct Client that owns the same email as the User', async () => {
    const phoneCandidate = {
      id: 'phone-client', userId: null, email: 'different@example.com', phone: '+966500000000',
      isActive: true, deletedAt: null, phoneVerified: new Date(), tokenVersion: 0,
    };
    const emailOwner = {
      id: 'email-owner', userId: 'other-user', email: 'same@example.com', phone: '+966511111111',
      isActive: true, deletedAt: null, phoneVerified: new Date(), tokenVersion: 0,
    };
    prismaMock.user.findFirst.mockResolvedValue({
      id: 'same-user', role: 'CLIENT', email: 'same@example.com', phone: '+966500000000',
      isActive: true, phoneVerifiedAt: new Date(), customRole: null,
    });
    prismaMock.client.findMany
      .mockResolvedValueOnce([phoneCandidate])
      .mockResolvedValueOnce([emailOwner]);
    prismaMock.client.findUnique.mockResolvedValue(phoneCandidate);
    prismaMock.otpCode.findFirst.mockResolvedValue({
      id: 'o-conflict', codeHash: goodCodeHash, expiresAt: new Date(Date.now() + 60000),
      attempts: 0, maxAttempts: 5, lockedUntil: null, consumedAt: null,
    });
    prismaMock.otpCode.updateMany.mockResolvedValue({ count: 1 });

    await expect(handler.execute({ identifier: '+966500000000', code: goodCode, purpose: MobileOtpPurposeDto.LOGIN }))
      .rejects.toThrow(/email belongs to another customer/i);
    expect(clientTokensMock.issueTokenPair).not.toHaveBeenCalled();
  });

  it('login: permits verified email only through one active explicit CLIENT link', async () => {
    const linked = {
      id: 'email-linked', userId: 'email-user', email: 'linked@example.com', phone: '+966500000000',
      isActive: true, deletedAt: null, phoneVerified: new Date(), tokenVersion: 3,
    };
    prismaMock.user.findFirst.mockResolvedValue({
      id: 'email-user', role: 'CLIENT', email: 'linked@example.com', phone: '+966500000000',
      isActive: true, emailVerifiedAt: new Date(), customRole: null,
    });
    prismaMock.client.findMany
      .mockResolvedValueOnce([linked])
      .mockResolvedValueOnce([linked]);
    prismaMock.client.findUnique.mockResolvedValue(linked);
    prismaMock.otpCode.findFirst.mockResolvedValue({
      id: 'o-email', codeHash: goodCodeHash, expiresAt: new Date(Date.now() + 60000),
      attempts: 0, maxAttempts: 5, lockedUntil: null, consumedAt: null,
    });
    prismaMock.otpCode.updateMany.mockResolvedValue({ count: 1 });
    clientTokensMock.issueTokenPair.mockResolvedValue({ accessToken: 'client-access', rawRefresh: 'r' });

    await expect(handler.execute({ identifier: 'linked@example.com', code: goodCode, purpose: MobileOtpPurposeDto.LOGIN }))
      .resolves.toEqual({ tokens: { accessToken: 'client-access', refreshToken: 'r' }, sessionKind: 'client' });
  });

  it.each([null, 'other-user'])('login: fails closed when the locked email Client link changes to %s', async (changedUserId) => {
    const linked = {
      id: 'email-race-linked', userId: 'email-user', email: 'race@example.com', phone: '+966500000000',
      isActive: true, deletedAt: null, phoneVerified: new Date(), tokenVersion: 3,
    };
    prismaMock.user.findFirst.mockResolvedValue({
      id: 'email-user', role: 'CLIENT', email: 'race@example.com', phone: '+966500000000',
      isActive: true, emailVerifiedAt: new Date(), customRole: null,
    });
    prismaMock.client.findMany.mockResolvedValueOnce([linked]);
    prismaMock.client.findUnique.mockResolvedValue({ ...linked, userId: changedUserId });

    await expect(handler.execute({ identifier: 'race@example.com', code: goodCode, purpose: MobileOtpPurposeDto.LOGIN }))
      .rejects.toThrow(/customer link changed/i);
    expect(prismaMock.otpCode.findFirst).not.toHaveBeenCalled();
    expect(clientTokensMock.issueTokenPair).not.toHaveBeenCalled();
  });

  it('login: rejects an OTP after the locked User email changes', async () => {
    const initial = {
      id: 'changed-email-user', role: 'CLIENT', email: 'old@example.com', phone: '+966500000000',
      isActive: true, emailVerifiedAt: new Date(), customRole: null,
    };
    prismaMock.user.findFirst.mockResolvedValue(initial);
    prismaMock.user.findUnique.mockResolvedValue({ ...initial, email: 'new@example.com' });

    await expect(handler.execute({ identifier: 'old@example.com', code: goodCode, purpose: MobileOtpPurposeDto.LOGIN }))
      .rejects.toThrow(/verified email changed/i);
    expect(prismaMock.otpCode.findFirst).not.toHaveBeenCalled();
  });

  it('login: supports an active Client-only phone account without creating a User', async () => {
    prismaMock.user.findFirst.mockResolvedValue(null);
    prismaMock.client.findMany.mockResolvedValue([{
      id: 'c-only', userId: null, phone: '+966500000000', email: null,
      isActive: true, deletedAt: null, phoneVerified: new Date(), tokenVersion: 0,
    }]);
    prismaMock.otpCode.findFirst.mockResolvedValue({
      id: 'o1', codeHash: goodCodeHash, expiresAt: new Date(Date.now() + 60000),
      attempts: 0, maxAttempts: 5, lockedUntil: null, consumedAt: null,
    });
    prismaMock.otpCode.updateMany.mockResolvedValue({ count: 1 });
    clientTokensMock.issueTokenPair.mockResolvedValue({ rawRefresh: 'r', accessToken: 'client-access' });

    await expect(handler.execute({ identifier: '+966500000000', code: goodCode, purpose: MobileOtpPurposeDto.LOGIN }))
      .resolves.toEqual({ tokens: { accessToken: 'client-access', refreshToken: 'r' }, sessionKind: 'client' });
    expect(tokensMock.issueTokenPair).not.toHaveBeenCalled();
  });

  it('login: links a legacy User CLIENT to a new Client after verified phone proof', async () => {
    prismaMock.user.findFirst.mockResolvedValue({
      id: 'legacy-user', role: 'CLIENT', name: 'Legacy Customer', firstName: 'Legacy', lastName: 'Customer',
      phone: '+966500000000', email: 'legacy@example.com', isActive: true, phoneVerifiedAt: new Date(), customRole: null,
    });
    prismaMock.client.findMany.mockResolvedValue([]);
    prismaMock.otpCode.findFirst.mockResolvedValue({
      id: 'o1', codeHash: goodCodeHash, expiresAt: new Date(Date.now() + 60000), attempts: 0,
      maxAttempts: 5, lockedUntil: null, consumedAt: null,
    });
    prismaMock.otpCode.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.client.create.mockResolvedValue({
      id: 'created-client', userId: 'legacy-user', email: null, phone: '+966500000000',
      phoneVerified: new Date(), isActive: true, deletedAt: null, tokenVersion: 0,
    });
    clientTokensMock.issueTokenPair.mockResolvedValue({ accessToken: 'client-access', rawRefresh: 'r' });

    await handler.execute({ identifier: '+966500000000', code: goodCode, purpose: MobileOtpPurposeDto.LOGIN });

    expect(prismaMock.client.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ userId: 'legacy-user', phone: '+966500000000' }),
    }));
  });

  it('login: a Client-only unverified phone becomes verified only after valid OTP proof', async () => {
    const client = { id: 'unverified-client', userId: null, phone: '+966500000000', email: null, phoneVerified: null, isActive: true, deletedAt: null, tokenVersion: 0 };
    prismaMock.user.findFirst.mockResolvedValue(null);
    prismaMock.client.findMany.mockResolvedValue([client]);
    prismaMock.client.findUnique.mockResolvedValue(client);
    prismaMock.client.update.mockResolvedValue({ ...client, phoneVerified: new Date() });
    prismaMock.otpCode.findFirst.mockResolvedValue({
      id: 'o1', codeHash: goodCodeHash, expiresAt: new Date(Date.now() + 60000), attempts: 0,
      maxAttempts: 5, lockedUntil: null, consumedAt: null,
    });
    prismaMock.otpCode.updateMany.mockResolvedValue({ count: 1 });
    clientTokensMock.issueTokenPair.mockResolvedValue({ accessToken: 'client-access', rawRefresh: 'r' });

    await handler.execute({ identifier: '+966500000000', code: goodCode, purpose: MobileOtpPurposeDto.LOGIN });

    expect(prismaMock.client.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'unverified-client' }, data: { phoneVerified: expect.any(Date) },
    }));
  });

  it('login: fails closed when the phone is linked to multiple Clients', async () => {
    prismaMock.user.findFirst.mockResolvedValue(null);
    prismaMock.client.findMany.mockResolvedValue([
      { id: 'c1', userId: null, isActive: true, deletedAt: null },
      { id: 'c2', userId: null, isActive: true, deletedAt: null },
    ]);
    await expect(handler.execute({ identifier: '+966500000000', code: goodCode, purpose: MobileOtpPurposeDto.LOGIN }))
      .rejects.toThrow(/conflict/i);
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
