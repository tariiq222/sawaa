import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { OtpPurpose } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { RedisService } from '../../../infrastructure/cache/redis.service';
import { TokenService } from '../shared/token.service';
import { VerifyDashboardOtpHandler } from './verify-dashboard-otp.handler';

jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
}));
import * as bcrypt from 'bcryptjs';

const mockDate = new Date('2025-01-01T00:00:00Z');

function createOtpRecord(overrides?: Partial<any>) {
  return {
    id: 'otp-1',
    identifier: 'test@test.com',
    purpose: OtpPurpose.DASHBOARD_LOGIN,
    codeHash: 'hash',
    expiresAt: new Date(mockDate.getTime() + 5 * 60 * 1000),
    consumedAt: null,
    lockedUntil: null,
    attempts: 0,
    maxAttempts: 3,
    ...overrides,
  };
}

function createUser(overrides?: Partial<any>) {
  return {
    id: 'u-1',
    email: 'test@test.com',
    phone: null,
    name: 'John Doe',
    gender: null,
    avatarUrl: null,
    isActive: true,
    role: 'ADMIN',
    isSuperAdmin: false,
    customRole: null,
    ...overrides,
  };
}

describe('VerifyDashboardOtpHandler', () => {
  let handler: VerifyDashboardOtpHandler;
  let prisma: any;
  let tokens: any;
  let redisClient: {
    get: jest.Mock;
    del: jest.Mock;
    multi: jest.Mock;
  };
  let redisMulti: { incr: jest.Mock; expire: jest.Mock; exec: jest.Mock };

  beforeEach(async () => {
    redisMulti = {
      incr: jest.fn().mockReturnThis(),
      expire: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([[null, 1], [null, 1]]),
    };
    redisClient = {
      get: jest.fn().mockResolvedValue(null),
      del: jest.fn().mockResolvedValue(1),
      multi: jest.fn().mockReturnValue(redisMulti),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VerifyDashboardOtpHandler,
        { provide: PrismaService, useValue: {
          otpCode: { findFirst: jest.fn(), update: jest.fn() },
          user: { findFirst: jest.fn() },
          // P1-8: handler now loads DB system-role permissions for the user's
          // built-in role (mirrors JwtStrategy). Default to none → BUILT_IN map.
          customRole: { findFirst: jest.fn().mockResolvedValue(null) },
        } },
        { provide: TokenService, useValue: {
          issueTokenPair: jest.fn(),
        } },
        { provide: RedisService, useValue: {
          getClient: jest.fn().mockReturnValue(redisClient),
        } },
      ],
    }).compile();

    handler = module.get<VerifyDashboardOtpHandler>(VerifyDashboardOtpHandler);
    prisma = module.get(PrismaService);
    tokens = module.get(TokenService);

    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
    jest.setSystemTime(mockDate);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('should be defined', () => expect(handler).toBeDefined());

  it('should throw when no OTP record found', async () => {
    prisma.otpCode.findFirst.mockResolvedValue(null);
    await expect(handler.execute({ identifier: 'test@test.com', code: '123456' })).rejects.toThrow(BadRequestException);
  });

  it('should throw when OTP expired', async () => {
    prisma.otpCode.findFirst.mockResolvedValue(createOtpRecord({ expiresAt: new Date(mockDate.getTime() - 1000) }));
    await expect(handler.execute({ identifier: 'test@test.com', code: '123456' })).rejects.toThrow(BadRequestException);
  });

  it('should throw when OTP locked out', async () => {
    prisma.otpCode.findFirst.mockResolvedValue(createOtpRecord({ lockedUntil: new Date(mockDate.getTime() + 1000) }));
    await expect(handler.execute({ identifier: 'test@test.com', code: '123456' })).rejects.toThrow(BadRequestException);
    expect(await handler.execute({ identifier: 'test@test.com', code: '123456' }).catch(e => e.message)).toBe('OTP_LOCKED_OUT');
  });

  it('should throw when max attempts reached', async () => {
    prisma.otpCode.findFirst.mockResolvedValue(createOtpRecord({ attempts: 3, maxAttempts: 3 }));
    await expect(handler.execute({ identifier: 'test@test.com', code: '123456' })).rejects.toThrow(BadRequestException);
  });

  it('should increment attempts and throw Unauthorized on wrong code', async () => {
    prisma.otpCode.findFirst.mockResolvedValue(createOtpRecord({ attempts: 1, maxAttempts: 3 }));
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);
    prisma.otpCode.update.mockResolvedValue({});

    await expect(handler.execute({ identifier: 'test@test.com', code: '123456' })).rejects.toThrow(UnauthorizedException);
    expect(prisma.otpCode.update).toHaveBeenCalledWith({
      where: { id: 'otp-1' },
      data: { attempts: { increment: 1 } },
    });
  });

  it('should lock OTP when next attempt reaches max', async () => {
    prisma.otpCode.findFirst.mockResolvedValue(createOtpRecord({ attempts: 2, maxAttempts: 3 }));
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);
    prisma.otpCode.update.mockResolvedValue({});

    await expect(handler.execute({ identifier: 'test@test.com', code: '123456' })).rejects.toThrow(UnauthorizedException);
    const updateCall = prisma.otpCode.update.mock.calls[0];
    expect(updateCall[0].data.lockedUntil).toBeInstanceOf(Date);
    expect(updateCall[0].data.lockedUntil.getTime()).toBe(mockDate.getTime() + 15 * 60 * 1000);
  });

  it('should throw when user not found', async () => {
    prisma.otpCode.findFirst.mockResolvedValue(createOtpRecord());
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    prisma.otpCode.update.mockResolvedValue({});
    prisma.user.findFirst.mockResolvedValue(null);

    await expect(handler.execute({ identifier: 'test@test.com', code: '123456' })).rejects.toThrow(UnauthorizedException);
  });

  it('should throw when user inactive', async () => {
    prisma.otpCode.findFirst.mockResolvedValue(createOtpRecord());
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    prisma.otpCode.update.mockResolvedValue({});
    prisma.user.findFirst.mockResolvedValue(createUser({ isActive: false }));

    await expect(handler.execute({ identifier: 'test@test.com', code: '123456' })).rejects.toThrow(UnauthorizedException);
  });

  it('should return tokens and user on success with email channel', async () => {
    prisma.otpCode.findFirst.mockResolvedValue(createOtpRecord());
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    prisma.otpCode.update.mockResolvedValue({});
    prisma.user.findFirst.mockResolvedValue(createUser());
    tokens.issueTokenPair.mockResolvedValue({ accessToken: 'at', refreshToken: 'rt' });

    const result = await handler.execute({ identifier: 'test@test.com', code: '123456' });
    expect(result.accessToken).toBe('at');
    expect(result.user.email).toBe('test@test.com');
    expect(result.user.firstName).toBe('John');
    expect(result.user.lastName).toBe('Doe');
    expect(result.user.permissions).toContain('booking:*');
  });

  it('should return tokens and user on success with phone channel', async () => {
    prisma.otpCode.findFirst.mockResolvedValue(createOtpRecord({ identifier: '+966501234567' }));
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    prisma.otpCode.update.mockResolvedValue({});
    prisma.user.findFirst.mockResolvedValue(createUser({ phone: '+966501234567', email: null }));
    tokens.issueTokenPair.mockResolvedValue({ accessToken: 'at', refreshToken: 'rt' });

    const result = await handler.execute({ identifier: '+966501234567', code: '123456' });
    expect(result.user.phone).toBe('+966501234567');
    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { phone: '+966501234567' },
      include: { customRole: { include: { permissions: true } } },
    });
  });

  it('should handle user with no name', async () => {
    prisma.otpCode.findFirst.mockResolvedValue(createOtpRecord());
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    prisma.otpCode.update.mockResolvedValue({});
    prisma.user.findFirst.mockResolvedValue(createUser({ name: null }));
    tokens.issueTokenPair.mockResolvedValue({ accessToken: 'at', refreshToken: 'rt' });

    const result = await handler.execute({ identifier: 'test@test.com', code: '123456' });
    expect(result.user.name).toBe('');
    expect(result.user.firstName).toBe('');
    expect(result.user.lastName).toBe('');
  });

  it('should handle superAdmin user', async () => {
    prisma.otpCode.findFirst.mockResolvedValue(createOtpRecord());
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    prisma.otpCode.update.mockResolvedValue({});
    prisma.user.findFirst.mockResolvedValue(createUser({ isSuperAdmin: true }));
    tokens.issueTokenPair.mockResolvedValue({ accessToken: 'at', refreshToken: 'rt' });

    const result = await handler.execute({ identifier: 'test@test.com', code: '123456' });
    expect(result.user.isSuperAdmin).toBe(true);
  });

  it('should handle user with customRole', async () => {
    prisma.otpCode.findFirst.mockResolvedValue(createOtpRecord());
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    prisma.otpCode.update.mockResolvedValue({});
    prisma.user.findFirst.mockResolvedValue(createUser({
      role: 'CUSTOM',
      customRole: { permissions: [{ action: 'manage', subject: 'booking' }] },
    }));
    tokens.issueTokenPair.mockResolvedValue({ accessToken: 'at', refreshToken: 'rt' });

    const result = await handler.execute({ identifier: 'test@test.com', code: '123456' });
    expect(result.user.permissions).toContain('booking:*');
  });

  // P1-8: DB system-role permission edits must be reflected in the returned
  // permissions[] (UI source of truth), matching JwtStrategy enforcement.
  it('reflects DB system-role permissions over the built-in map (P1-8)', async () => {
    prisma.otpCode.findFirst.mockResolvedValue(createOtpRecord());
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    prisma.otpCode.update.mockResolvedValue({});
    // RECEPTIONIST built-in is create/read/update Booking; the DB row narrows it.
    prisma.user.findFirst.mockResolvedValue(createUser({ role: 'RECEPTIONIST' }));
    prisma.customRole.findFirst.mockResolvedValue({
      permissions: [{ action: 'read', subject: 'Booking' }],
    });
    tokens.issueTokenPair.mockResolvedValue({ accessToken: 'at', refreshToken: 'rt' });

    const result = await handler.execute({ identifier: 'test@test.com', code: '123456' });

    expect(prisma.customRole.findFirst).toHaveBeenCalledWith({
      where: { systemKey: 'RECEPTIONIST' },
      select: { permissions: { select: { action: true, subject: true } } },
    });
    expect(result.user.permissions).toEqual(['booking:read']);
  });

  it('does not load system-role permissions for SUPER_ADMIN (manage:all from code) (P1-8)', async () => {
    prisma.otpCode.findFirst.mockResolvedValue(createOtpRecord());
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    prisma.otpCode.update.mockResolvedValue({});
    prisma.user.findFirst.mockResolvedValue(createUser({ role: 'SUPER_ADMIN', isSuperAdmin: true }));
    tokens.issueTokenPair.mockResolvedValue({ accessToken: 'at', refreshToken: 'rt' });

    const result = await handler.execute({ identifier: 'test@test.com', code: '123456' });

    expect(prisma.customRole.findFirst).not.toHaveBeenCalled();
    expect(result.user.permissions).toContain('*');
  });

  describe('identifier-level failed-verify lockout window', () => {
    it('should reject even a fresh correct code when the window counter is at max (lockout wins)', async () => {
      redisClient.get.mockResolvedValue('5');
      prisma.otpCode.findFirst.mockResolvedValue(createOtpRecord());
      (bcrypt.compare as jest.Mock).mockClear();
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(
        handler.execute({ identifier: 'test@test.com', code: '123456' }),
      ).rejects.toThrow(BadRequestException);
      expect(
        await handler.execute({ identifier: 'test@test.com', code: '123456' }).catch((e) => e.message),
      ).toBe('OTP_LOCKED_OUT');

      // Lockout is decided before any OTP row is fetched or compared
      expect(prisma.otpCode.findFirst).not.toHaveBeenCalled();
      expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    it('should check the counter under the normalized identifier (case-insensitive email)', async () => {
      redisClient.get.mockResolvedValue('5');

      await expect(
        handler.execute({ identifier: 'Test@Test.COM', code: '123456' }),
      ).rejects.toThrow(BadRequestException);

      expect(redisClient.get).toHaveBeenCalledWith('dashboard_otp:failed:test@test.com');
    });

    it('should atomically increment the window counter with a 15-minute TTL on wrong code', async () => {
      prisma.otpCode.findFirst.mockResolvedValue(createOtpRecord());
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      prisma.otpCode.update.mockResolvedValue({});

      await expect(
        handler.execute({ identifier: 'test@test.com', code: '000000' }),
      ).rejects.toThrow(UnauthorizedException);

      expect(redisClient.multi).toHaveBeenCalledTimes(1);
      expect(redisMulti.incr).toHaveBeenCalledWith('dashboard_otp:failed:test@test.com');
      expect(redisMulti.expire).toHaveBeenCalledWith('dashboard_otp:failed:test@test.com', 900);
      expect(redisMulti.exec).toHaveBeenCalledTimes(1);
    });

    it('should clear the window counter on successful verify', async () => {
      prisma.otpCode.findFirst.mockResolvedValue(createOtpRecord());
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      prisma.otpCode.update.mockResolvedValue({});
      prisma.user.findFirst.mockResolvedValue(createUser());
      tokens.issueTokenPair.mockResolvedValue({ accessToken: 'at', refreshToken: 'rt' });

      await handler.execute({ identifier: 'test@test.com', code: '123456' });

      expect(redisClient.del).toHaveBeenCalledWith('dashboard_otp:failed:test@test.com');
    });

    it('should allow attempts below the window max (counter at 4 of 5)', async () => {
      redisClient.get.mockResolvedValue('4');
      prisma.otpCode.findFirst.mockResolvedValue(createOtpRecord());
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      prisma.otpCode.update.mockResolvedValue({});
      prisma.user.findFirst.mockResolvedValue(createUser());
      tokens.issueTokenPair.mockResolvedValue({ accessToken: 'at', refreshToken: 'rt' });

      const result = await handler.execute({ identifier: 'test@test.com', code: '123456' });
      expect(result.accessToken).toBe('at');
      expect(redisClient.del).toHaveBeenCalledWith('dashboard_otp:failed:test@test.com');
    });
  });
});
