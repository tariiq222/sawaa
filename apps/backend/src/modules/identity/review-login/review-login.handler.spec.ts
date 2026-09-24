import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { ReviewLoginHandler } from './review-login.handler';
import { ClientLoginHandler } from '../client-auth/client-login.handler';
import { PasswordService } from '../shared/password.service';
import { PrismaService } from '../../../infrastructure/database';
import { RedisService } from '../../../infrastructure/cache/redis.service';
import { ClientTokenService } from '../shared/client-token.service';

describe('review account password boundary', () => {
  const id = '939c9483-0967-438b-8275-099b0a807249';
  const email = 'apple@review.sawaa.invalid';
  const password = 'LocalTestOnly-42!';
  const passwords = new PasswordService();
  let row: Record<string, unknown>;
  let handler: ReviewLoginHandler;
  let config: ConfigService;
  let issue: jest.Mock;

  beforeEach(async () => {
    row = { id, email, passwordHash: await passwords.hash(password), userId: null, phone: null,
      isActive: true, deletedAt: null, tokenVersion: 3, loginAttempts: 0, lockoutUntil: null };
    const prisma = { client: {
      findUnique: jest.fn(async ({ where }) => where.id === row.id ? row : null),
      findFirst: jest.fn(async ({ where }) => where.email === row.email ? row : null),
      update: jest.fn(async () => row),
    } } as unknown as PrismaService;
    const multi = { incr: jest.fn().mockReturnThis(), expire: jest.fn().mockReturnThis(), exec: jest.fn().mockResolvedValue([[null, 1]]) };
    const redis = { getClient: () => ({ multi: () => multi, expire: jest.fn(), del: jest.fn() }) } as unknown as RedisService;
    issue = jest.fn().mockResolvedValue({ accessToken: 'client-access', rawRefresh: 'client-refresh', accessMaxAgeMs: 900000, refreshMaxAgeMs: 1000000 });
    const login = new ClientLoginHandler(prisma, redis, passwords, { issueTokenPair: issue } as unknown as ClientTokenService);
    config = new ConfigService({ MOBILE_REVIEW_CLIENT_ID: id });
    handler = new ReviewLoginHandler(config, prisma, login);
  });

  it('returns ordinary client namespace tokens for the configured synthetic account', async () => {
    await expect(handler.execute({ email, password }, '127.0.0.1')).resolves.toEqual({
      sessionKind: 'client', tokens: { accessToken: 'client-access', refreshToken: 'client-refresh' },
    });
    expect(issue).toHaveBeenCalledWith({ id, email, tokenVersion: 3 });
  });
  it('fails closed when no review account is configured', async () => {
    config.set('MOBILE_REVIEW_CLIENT_ID', '');
    await expect(handler.execute({ email, password }, '127.0.0.1')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(issue).not.toHaveBeenCalled();
  });
  it('does not grant another customer password access through this route', async () => {
    await expect(handler.execute({ email: 'customer@example.com', password }, '127.0.0.1')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(issue).not.toHaveBeenCalled();
  });
  it('verifies the real password rather than accepting an OTP or arbitrary secret', async () => {
    await expect(handler.execute({ email, password: 'WrongPassword-42!' }, '127.0.0.1')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(issue).not.toHaveBeenCalled();
  });
  it.each([
    { isActive: false }, { deletedAt: new Date() }, { userId: 'staff-id' },
    { phone: '+966500000001' }, { email: 'real@example.com' },
    { lockoutUntil: new Date(Date.now() + 600000) },
  ])('refuses unsafe or locked review identity %p', async (changes) => {
    Object.assign(row, changes);
    await expect(handler.execute({ email: row.email as string, password }, '127.0.0.1')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(issue).not.toHaveBeenCalled();
  });
});
