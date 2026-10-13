import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ClsService } from 'nestjs-cls';
import { OtpChannel, OtpPurpose } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { RedisService } from '../../../infrastructure/cache/redis.service';
import { NotificationChannelRegistry } from '../../comms/notification-channel/notification-channel-registry';
import { PlatformSettingsService } from '../../platform/settings/platform-settings.service';
import { RequestOtpHandler } from '../otp/request-otp.handler';
import { RequestMobileLoginOtpHandler } from '../request-mobile-login-otp/request-mobile-login-otp.handler';
import { VerifyMobileOtpHandler } from '../verify-mobile-otp/verify-mobile-otp.handler';
import { MobileOtpPurposeDto } from '../verify-mobile-otp/verify-mobile-otp.dto';
import { TokenService } from '../shared/token.service';
import { ClientTokenService } from '../shared/client-token.service';
import { ReviewOtpHandler } from './review-otp.handler';

const email = 'apple@review.sawaa.invalid';
// Public synthetic fixture only; never a deployment credential.
const fixtureCode = '4837';

describe('Synthetic review OTP through real request and verification handlers', () => {
  let codeHash: string;
  let config: Record<string, unknown>;
  let client: any;
  let state: { otp: any; user: any; count: number; cooldown: boolean; lockedClient?: any };
  let requestLogin: RequestMobileLoginOtpHandler;
  let requestOtp: RequestOtpHandler;
  let verify: VerifyMobileOtpHandler;
  let delivered: string[];
  let issuedClientIds: string[];

  beforeAll(async () => { codeHash = await bcrypt.hash(fixtureCode, 10); });
  beforeEach(async () => {
    config = {
      MOBILE_REVIEW_CLIENT_ID: '97e32394-5ec7-441c-a090-af4ffb187fb8',
      MOBILE_REVIEW_OTP_HASH: codeHash,
      MOBILE_REVIEW_OTP_EXPIRES_AT: new Date(Date.now() + 3_600_000).toISOString(),
    };
    client = {
      id: config.MOBILE_REVIEW_CLIENT_ID, email, userId: null, phone: null,
      isActive: true, deletedAt: null, emailVerified: new Date(), passwordHash: codeHash, tokenVersion: 2,
    };
    state = { otp: null, user: null, count: 0, cooldown: false };
    delivered = []; issuedClientIds = [];
    const db: any = {
      user: { findFirst: async () => state.user },
      client: {
        findUnique: async ({ where }: any) => where.id === client.id ? (state.lockedClient ?? client) : null,
        findMany: async () => [],
      },
      otpCode: {
        count: async () => state.count,
        create: async ({ data }: any) => {
          state.count++;
          state.otp = { id: 'challenge', ...data, consumedAt: null, lockedUntil: null, attempts: 0, maxAttempts: 5 };
          return { id: 'challenge' };
        },
        findFirst: async ({ where }: any) => {
          const row = state.otp;
          if (!row) return null;
          return Object.entries(where).every(([key, value]) => row[key] === value) ? row : null;
        },
        update: async ({ data }: any) => {
          if (data.attempts) state.otp.attempts += data.attempts.increment;
          if (data.lockedUntil) state.otp.lockedUntil = data.lockedUntil;
          return state.otp;
        },
        updateMany: async ({ data }: any) => {
          if (!state.otp || state.otp.consumedAt) return { count: 0 };
          Object.assign(state.otp, data); return { count: 1 };
        },
        delete: async () => { state.otp = null; },
      },
      $queryRaw: async () => [],
    };
    const module = await Test.createTestingModule({ providers: [
      RequestMobileLoginOtpHandler, RequestOtpHandler, VerifyMobileOtpHandler, ReviewOtpHandler,
      { provide: PrismaService, useValue: db },
      { provide: RlsTransactionService, useValue: { withTransaction: (fn: any) => fn(db) } },
      { provide: ConfigService, useValue: { get: (key: string) => config[key] } },
      { provide: ClsService, useValue: { run: (fn: any) => fn(), set: () => undefined } },
      { provide: RedisService, useValue: { getClient: () => ({ set: async () => state.cooldown ? null : 'OK' }) } },
      { provide: NotificationChannelRegistry, useValue: { resolve: () => ({ send: async (_: string, code: string) => { delivered.push(code); } }) } },
      { provide: PlatformSettingsService, useValue: { get: async () => false } },
      { provide: TokenService, useValue: { issueTokenPair: () => { throw new Error('review must never issue staff tokens'); } } },
      { provide: ClientTokenService, useValue: { issueTokenPair: async (identity: any) => {
        issuedClientIds.push(identity.id); return { accessToken: 'client-access', rawRefresh: 'client-refresh' };
      } } },
    ] }).compile();
    requestLogin = module.get(RequestMobileLoginOtpHandler);
    requestOtp = module.get(RequestOtpHandler);
    verify = module.get(VerifyMobileOtpHandler);
  });

  const verifyCode = (code = fixtureCode, identifier = email, purpose = MobileOtpPurposeDto.LOGIN) =>
    verify.execute({ identifier, code, purpose });

  it('requests the fixed challenge without delivery and issues only the synthetic client session', async () => {
    expect(await requestLogin.execute({ identifier: ` ${email.toUpperCase()} ` })).toEqual({ maskedIdentifier: 'a***@review.sawaa.invalid' });
    expect(state.otp).not.toBeNull();
    expect(state.otp?.codeHash).toBe(codeHash);
    expect(delivered).toEqual([]);
    expect(await verifyCode()).toEqual({ sessionKind: 'client', tokens: { accessToken: 'client-access', refreshToken: 'client-refresh' } });
    expect(issuedClientIds).toEqual([client.id]);
    expect(state.otp.consumedAt).toBeInstanceOf(Date);
    await expect(verifyCode()).rejects.toThrow();
  });

  it.each(['MOBILE_REVIEW_CLIENT_ID', 'MOBILE_REVIEW_OTP_HASH', 'MOBILE_REVIEW_OTP_EXPIRES_AT'])('fails closed when %s is missing', async (key) => {
    delete config[key];
    await requestLogin.execute({ identifier: email });
    expect(state.otp).toBeNull();
    await expect(verifyCode()).rejects.toThrow();
  });

  it.each([
    ['wrong ID', 'MOBILE_REVIEW_CLIENT_ID', 'f997a855-1f0a-4f5c-8c6e-e63b2c6b751d'],
    ['malformed hash', 'MOBILE_REVIEW_OTP_HASH', '4837'],
    ['retired', 'MOBILE_REVIEW_OTP_EXPIRES_AT', '2000-01-01T00:00:00Z'],
    ['invalid date', 'MOBILE_REVIEW_OTP_EXPIRES_AT', 'invalid'],
  ])('does not issue review challenge when configuration is %s', async (_, key, value) => {
    config[key] = value;
    await requestLogin.execute({ identifier: email });
    expect(state.otp).toBeNull();
    await expect(verifyCode()).rejects.toThrow();
  });

  it.each([
    ['real email', { email: 'customer@example.com' }], ['linked User', { userId: 'staff' }],
    ['phone', { phone: '+966500000000' }], ['disabled', { isActive: false }],
    ['deleted', { deletedAt: new Date() }], ['unverified', { emailVerified: null }],
    ['no password', { passwordHash: null }],
  ])('refuses identity which becomes %s', async (_, change) => {
    Object.assign(client, change);
    await requestLogin.execute({ identifier: email });
    expect(state.otp).toBeNull();
    await expect(verifyCode()).rejects.toThrow();
    expect(issuedClientIds).toEqual([]);
  });

  it('never makes the fixed code usable for registration or another address', async () => {
    await requestLogin.execute({ identifier: email });
    await expect(verifyCode(fixtureCode, email, MobileOtpPurposeDto.REGISTER)).rejects.toThrow();
    await expect(verifyCode(fixtureCode, 'customer@example.com')).rejects.toThrow();
    expect(issuedClientIds).toEqual([]);
  });

  it('commits wrong attempts and locks the challenge after five failures', async () => {
    await requestLogin.execute({ identifier: email });
    for (let attempt = 1; attempt <= 5; attempt++) {
      await expect(verifyCode('0000')).rejects.toThrow();
      expect(state.otp.attempts).toBe(attempt);
    }
    expect(state.otp.lockedUntil).toBeInstanceOf(Date);
    await expect(verifyCode()).rejects.toThrow();
    expect(issuedClientIds).toEqual([]);
  });

  it('requires a fresh challenge and retains five-minute expiry', async () => {
    await expect(verifyCode()).rejects.toThrow();
    await requestLogin.execute({ identifier: email });
    expect(state.otp.expiresAt.getTime()).toBeLessThanOrEqual(Date.now() + 300_000);
    state.otp.expiresAt = new Date(Date.now() - 1);
    await expect(verifyCode()).rejects.toThrow();
  });

  it('clamps expiry to retirement and refuses leftover rows after retirement or hash rotation', async () => {
    const retirement = new Date(Date.now() + 60_000);
    config.MOBILE_REVIEW_OTP_EXPIRES_AT = retirement.toISOString();
    await requestLogin.execute({ identifier: email });
    expect(state.otp.expiresAt).toEqual(retirement);
    config.MOBILE_REVIEW_OTP_HASH = await bcrypt.hash('9362', 10);
    await expect(verifyCode()).rejects.toThrow();
    config.MOBILE_REVIEW_OTP_HASH = codeHash;
    config.MOBILE_REVIEW_OTP_EXPIRES_AT = '2000-01-01T00:00:00Z';
    await expect(verifyCode()).rejects.toThrow();
    expect(issuedClientIds).toEqual([]);
  });

  it.each([{ userId: 'staff' }, { phone: '+966500000000' }, { emailVerified: null }])('rechecks locked identity %j before authenticating', async (change) => {
    await requestLogin.execute({ identifier: email });
    state.lockedClient = { ...client, ...change };
    await expect(verifyCode()).rejects.toThrow();
    expect(issuedClientIds).toEqual([]);
  });

  it('retains cooldown and hourly cap for the review account', async () => {
    state.cooldown = true;
    await expect(requestLogin.execute({ identifier: email })).rejects.toThrow(/wait/i);
    state.cooldown = false; state.count = 5;
    await expect(requestLogin.execute({ identifier: email })).rejects.toThrow(/too many/i);
    expect(state.otp).toBeNull();
  });

  it('does not replace random codes or provider delivery for password reset or SMS', async () => {
    await requestOtp.execute({ identifier: email, channel: OtpChannel.EMAIL, purpose: OtpPurpose.CLIENT_PASSWORD_RESET });
    expect(state.otp.codeHash).not.toBe(codeHash);
    expect(delivered[0]).toMatch(/^\d{4}$/);
    await requestOtp.execute({ identifier: '+966500000000', channel: OtpChannel.SMS, purpose: OtpPurpose.MOBILE_LOGIN });
    expect(state.otp.codeHash).not.toBe(codeHash);
    expect(delivered).toHaveLength(2);
  });
});
