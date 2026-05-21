import { Test } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { LoginHandler } from './login.handler';
import { PrismaService } from '../../../infrastructure/database';
import { RedisService } from '../../../infrastructure/cache/redis.service';
import { PasswordService } from '../shared/password.service';
import { TokenService } from '../shared/token.service';
import { ClsService } from 'nestjs-cls';

describe('LoginHandler', () => {
  let handler: LoginHandler;
  let prisma: { user: { findUnique: jest.Mock; update: jest.Mock } };
  let password: { verify: jest.Mock };
  let tokens: { issueTokenPair: jest.Mock };
  let redisClient: { multi: jest.Mock; incr: jest.Mock; expire: jest.Mock; exec: jest.Mock; del: jest.Mock };
  let redis: { getClient: jest.Mock };
  let cls: { set: jest.Mock };

  beforeEach(async () => {
    const createChain = (execResult: unknown = [[null, 1], [null, 1]]) => ({
      incr: jest.fn().mockReturnThis(),
      expire: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(execResult),
    });
    redisClient = {
      multi: jest.fn().mockReturnValue(createChain()),
      del: jest.fn().mockResolvedValue(1),
      expire: jest.fn().mockResolvedValue(1),
    } as any;
    redis = { getClient: jest.fn().mockReturnValue(redisClient) };
    prisma = {
      user: {
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    password = { verify: jest.fn() };
    tokens = { issueTokenPair: jest.fn().mockResolvedValue({ accessToken: 'at', refreshToken: 'rt' }) };
    cls = { set: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        LoginHandler,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: redis },
        { provide: PasswordService, useValue: password },
        { provide: TokenService, useValue: tokens },
        { provide: ClsService, useValue: cls },
      ],
    }).compile();

    handler = module.get(LoginHandler);
  });

  const cmd = { email: 'a@b.com', password: 'secret', ip: '1.2.3.4' };

  it('returns tokens on successful login', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      isActive: true,
      passwordHash: 'hash',
      failedLoginAttempts: 0,
      lockedUntil: null,
      isSuperAdmin: false,
      customRole: null,
    });
    password.verify.mockResolvedValue(true);
    const result = await handler.execute(cmd);
    expect(result.accessToken).toBe('at');
    expect(redisClient.del).toHaveBeenCalledTimes(2);
  });

  it('throws when user not found', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(handler.execute(cmd)).rejects.toThrow(UnauthorizedException);
  });

  it('throws when account is inactive', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1', email: 'a@b.com', isActive: false, passwordHash: 'hash', failedLoginAttempts: 0, lockedUntil: null, isSuperAdmin: false,
    });
    await expect(handler.execute(cmd)).rejects.toThrow('Account is inactive');
  });

  it('throws when passwordHash is missing', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1', email: 'a@b.com', isActive: true, passwordHash: null, failedLoginAttempts: 0, lockedUntil: null, isSuperAdmin: false,
    });
    await expect(handler.execute(cmd)).rejects.toThrow('Invalid credentials');
  });

  it('throws when account is locked', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1', email: 'a@b.com', isActive: true, passwordHash: 'hash', failedLoginAttempts: 0, lockedUntil: new Date(Date.now() + 60000), isSuperAdmin: false,
    });
    await expect(handler.execute(cmd)).rejects.toThrow('Account locked');
  });

  it('increments failed attempts atomically on wrong password', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1', email: 'a@b.com', isActive: true, passwordHash: 'hash', failedLoginAttempts: 0, lockedUntil: null, isSuperAdmin: false,
    });
    password.verify.mockResolvedValue(false);
    prisma.user.update.mockResolvedValue({ failedLoginAttempts: 1 });
    await expect(handler.execute(cmd)).rejects.toThrow('Invalid credentials');
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { failedLoginAttempts: { increment: 1 } }, select: { failedLoginAttempts: true } }),
    );
    // No lock follow-up at attempt 1
    expect(prisma.user.update).toHaveBeenCalledTimes(1);
  });

  it('locks account after max failed attempts', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1', email: 'a@b.com', isActive: true, passwordHash: 'hash', failedLoginAttempts: 4, lockedUntil: null, isSuperAdmin: false,
    });
    password.verify.mockResolvedValue(false);
    // First call: atomic increment returns the post-increment value crossing the threshold
    prisma.user.update.mockResolvedValueOnce({ failedLoginAttempts: 5 });
    prisma.user.update.mockResolvedValueOnce({} as any);
    await expect(handler.execute(cmd)).rejects.toThrow('Invalid credentials');
    // First call atomically increments.
    expect(prisma.user.update).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ data: { failedLoginAttempts: { increment: 1 } }, select: { failedLoginAttempts: true } }),
    );
    // Second call applies the lock + resets counter.
    expect(prisma.user.update).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ data: expect.objectContaining({ failedLoginAttempts: 0, lockedUntil: expect.any(Date) }) }),
    );
  });

  it('resets failed attempts on successful login after failures', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1', email: 'a@b.com', isActive: true, passwordHash: 'hash', failedLoginAttempts: 2, lockedUntil: null, isSuperAdmin: false,
    });
    password.verify.mockResolvedValue(true);
    await handler.execute(cmd);
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { failedLoginAttempts: 0, lockedUntil: null } }),
    );
  });

  it('resets failed attempts when lockedUntil was set but password is correct now', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1', email: 'a@b.com', isActive: true, passwordHash: 'hash', failedLoginAttempts: 1, lockedUntil: new Date(Date.now() - 1000), isSuperAdmin: false,
    });
    password.verify.mockResolvedValue(true);
    await handler.execute(cmd);
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { failedLoginAttempts: 0, lockedUntil: null } }),
    );
  });

  it('rate limits by email', async () => {
    const chain = { incr: jest.fn().mockReturnThis(), expire: jest.fn().mockReturnThis(), exec: jest.fn().mockResolvedValue([[null, 11], [null, 1]]) };
    redisClient.multi.mockReturnValue(chain);
    await expect(handler.execute(cmd)).rejects.toThrow('Too many attempts');
  });

  it('rate limits by ip', async () => {
    const ipChain = { incr: jest.fn().mockReturnThis(), expire: jest.fn().mockReturnThis(), exec: jest.fn().mockResolvedValue([[null, 31], [null, 1]]) };
    const emailChain = { incr: jest.fn().mockReturnThis(), expire: jest.fn().mockReturnThis(), exec: jest.fn().mockResolvedValue([[null, 1], [null, 1]]) };
    redisClient.multi.mockReturnValueOnce(emailChain).mockReturnValueOnce(ipChain);
    await expect(handler.execute(cmd)).rejects.toThrow('Too many attempts');
  });

  it('uses unknown ip when not provided', async () => {
    const chain = { incr: jest.fn().mockReturnThis(), expire: jest.fn().mockReturnThis(), exec: jest.fn().mockResolvedValue([[null, 1], [null, 1]]) };
    redisClient.multi.mockReturnValue(chain);
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1', email: 'a@b.com', isActive: true, passwordHash: 'hash', failedLoginAttempts: 0, lockedUntil: null, isSuperAdmin: false,
    });
    password.verify.mockResolvedValue(true);
    await handler.execute({ email: 'a@b.com', password: 'secret' });
    expect(redisClient.multi).toHaveBeenCalled();
  });

  it('extends rate limit expiry on unauthorized error', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    const chain = { incr: jest.fn().mockReturnThis(), expire: jest.fn().mockReturnThis(), exec: jest.fn().mockResolvedValue([[null, 1], [null, 1]]) };
    redisClient.multi.mockReturnValue(chain);
    await expect(handler.execute(cmd)).rejects.toThrow(UnauthorizedException);
    expect(redisClient.del).not.toHaveBeenCalled();
  });
});
