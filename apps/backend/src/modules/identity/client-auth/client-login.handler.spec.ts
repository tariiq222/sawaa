import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { ClientLoginHandler } from './client-login.handler';
import { PrismaService } from '../../../infrastructure/database';
import { RedisService } from '../../../infrastructure/cache/redis.service';
import { PasswordService } from '../shared/password.service';
import { ClientTokenService } from '../shared/client-token.service';

describe('ClientLoginHandler', () => {
  let handler: ClientLoginHandler;

  const mockPrisma = {
    client: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    clientRefreshToken: {
      create: jest.fn(),
    },
  };

  // The handler now uses an atomic pipeline: multi().incr(key).expire(key, ttl).exec().
  // exec() resolves to [[err, incrResult], [err, expireResult]] (ioredis shape).
  // We queue exec() results in call order (email pipeline first, then ip pipeline).
  const execResults: unknown[] = [];
  const multiIncr = jest.fn();
  const multiExpire = jest.fn();
  const multiExec = jest.fn(() => Promise.resolve(execResults.shift() ?? [[null, 1], [null, 1]]));
  const multiBuilder: { incr: jest.Mock; expire: jest.Mock; exec: jest.Mock } = {
    incr: multiIncr,
    expire: multiExpire,
    exec: multiExec,
  };
  // make incr/expire chainable
  multiIncr.mockReturnValue(multiBuilder);
  multiExpire.mockReturnValue(multiBuilder);

  const mockRedisClient = {
    multi: jest.fn(() => multiBuilder),
    incr: jest.fn(),
    expire: jest.fn(),
    del: jest.fn(),
  };

  /** Queue attempt counts for the next [email, ip] multi/exec pipelines. */
  function queueAttempts(emailCount: number, ipCount: number) {
    execResults.push([[null, emailCount], [null, 1]]);
    execResults.push([[null, ipCount], [null, 1]]);
  }

  const mockRedis = { getClient: jest.fn(() => mockRedisClient) };
  const mockPasswords = { verify: jest.fn() };
  const mockClientTokens = {
    issueTokenPair: jest.fn().mockResolvedValue({
      accessToken: 'mock-access-token',
      accessMaxAgeMs: 900_000,
      rawRefresh: 'mock-raw-refresh',
      refreshMaxAgeMs: 604_800_000,
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    execResults.length = 0;
    // Re-establish chainable behavior after clearAllMocks wiped return values.
    multiIncr.mockReturnValue(multiBuilder);
    multiExpire.mockReturnValue(multiBuilder);
    multiExec.mockImplementation(() => Promise.resolve(execResults.shift() ?? [[null, 1], [null, 1]]));
    mockRedisClient.multi.mockImplementation(() => multiBuilder);
    mockClientTokens.issueTokenPair.mockResolvedValue({
      accessToken: 'mock-access-token',
      accessMaxAgeMs: 900_000,
      rawRefresh: 'mock-raw-refresh',
      refreshMaxAgeMs: 604_800_000,
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClientLoginHandler,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedis },
        { provide: PasswordService, useValue: mockPasswords },
        { provide: ClientTokenService, useValue: mockClientTokens },
      ],
    }).compile();

    handler = module.get<ClientLoginHandler>(ClientLoginHandler);
  });

  describe('execute', () => {
    it('returns tokens on successful login', async () => {
      mockPrisma.client.findFirst.mockResolvedValue({
        id: 'cl-1',
        email: 'test@example.com',
        passwordHash: 'hashed_pw',
        loginAttempts: 0,
        lockoutUntil: null,
      });
      queueAttempts(1, 1);
      mockPasswords.verify.mockResolvedValue(true);
      mockPrisma.client.update.mockResolvedValue({ id: 'cl-1' });

      const result = await handler.execute(
        { email: 'test@example.com', password: 'SecurePass123' },
        '1.2.3.4',
      );

      // Lockout counters are incremented atomically via a multi/incr/expire/exec pipeline.
      expect(mockRedisClient.multi).toHaveBeenCalled();
      expect(multiIncr).toHaveBeenCalledWith('client_login:email:test@example.com');
      expect(multiIncr).toHaveBeenCalledWith('client_login:ip:1.2.3.4');
      expect(multiExpire).toHaveBeenCalledWith('client_login:email:test@example.com', 600);
      expect(multiExpire).toHaveBeenCalledWith('client_login:ip:1.2.3.4', 600);
      expect(multiExec).toHaveBeenCalled();
      // Non-atomic standalone incr must no longer be used.
      expect(mockRedisClient.incr).not.toHaveBeenCalled();

      expect(result.accessToken).toBe('mock-access-token');
      expect(result.refreshToken).toBe('mock-raw-refresh');
      expect(result.clientId).toBe('cl-1');
      expect(mockRedisClient.del).toHaveBeenCalledWith('client_login:email:test@example.com');
      expect(mockRedisClient.del).toHaveBeenCalledWith('client_login:ip:1.2.3.4');
      expect(mockPrisma.client.update).toHaveBeenCalledWith({
        where: { id: 'cl-1' },
        data: { lastLoginAt: expect.any(Date) },
      });
      expect(mockClientTokens.issueTokenPair).toHaveBeenCalledWith(
        { id: 'cl-1', email: 'test@example.com' },
        expect.objectContaining({ organizationId: expect.any(String) }),
      );
    });

    it('throws Unauthorized for non-existent client', async () => {
      mockPrisma.client.findFirst.mockResolvedValue(null);

      await expect(
        handler.execute({ email: 'nobody@example.com', password: 'WrongPass1' }, '1.2.3.4'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws Unauthorized for locked account', async () => {
      mockPrisma.client.findFirst.mockResolvedValue({
        id: 'cl-2',
        email: 'locked@example.com',
        passwordHash: 'hashed_pw',
        lockoutUntil: new Date(Date.now() + 10 * 60 * 1000),
      });

      await expect(
        handler.execute({ email: 'locked@example.com', password: 'SecurePass123' }, '1.2.3.4'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws Unauthorized for wrong password', async () => {
      mockPrisma.client.findFirst.mockResolvedValue({
        id: 'cl-3',
        email: 'test@example.com',
        passwordHash: 'hashed_pw',
        loginAttempts: 0,
        lockoutUntil: null,
      });
      queueAttempts(2, 1);
      mockPasswords.verify.mockResolvedValue(false);
      mockPrisma.client.update.mockResolvedValue({ id: 'cl-3' });

      await expect(
        handler.execute({ email: 'test@example.com', password: 'WrongPass1' }, '1.2.3.4'),
      ).rejects.toThrow(UnauthorizedException);

      expect(mockPrisma.client.update).toHaveBeenCalledWith({
        where: { id: 'cl-3' },
        data: { loginAttempts: { increment: 1 }, lockoutUntil: undefined },
      });
    });

    it('locks account after 5 failed attempts', async () => {
      mockPrisma.client.findFirst.mockResolvedValue({
        id: 'cl-4',
        email: 'test@example.com',
        passwordHash: 'hashed_pw',
        loginAttempts: 4,
        lockoutUntil: null,
      });
      queueAttempts(5, 1);
      mockPasswords.verify.mockResolvedValue(false);
      mockPrisma.client.update.mockResolvedValue({ id: 'cl-4' });

      await expect(
        handler.execute({ email: 'test@example.com', password: 'WrongPass1' }, '1.2.3.4'),
      ).rejects.toThrow(UnauthorizedException);

      expect(mockPrisma.client.update).toHaveBeenCalledWith({
        where: { id: 'cl-4' },
        data: {
          loginAttempts: { increment: 1 },
          lockoutUntil: expect.any(Date),
        },
      });
    });

    it('throws Unauthorized when per-email rate limit exceeded', async () => {
      mockPrisma.client.findFirst.mockResolvedValue({
        id: 'cl-5',
        email: 'test@example.com',
        passwordHash: 'hashed_pw',
        lockoutUntil: null,
      });
      // email key returns 6 (over limit of 5), IP key returns 1
      queueAttempts(6, 1);

      await expect(
        handler.execute({ email: 'test@example.com', password: 'WrongPass1' }, '1.2.3.4'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws Unauthorized when per-IP rate limit exceeded', async () => {
      mockPrisma.client.findFirst.mockResolvedValue({
        id: 'cl-6',
        email: 'test@example.com',
        passwordHash: 'hashed_pw',
        lockoutUntil: null,
      });
      // email key returns 1 (fine), IP key returns 21 (over limit of 20)
      queueAttempts(1, 21);

      await expect(
        handler.execute({ email: 'test@example.com', password: 'WrongPass1' }, '5.5.5.5'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('uses an atomic multi/incr/expire/exec pipeline for both email and ip keys', async () => {
      mockPrisma.client.findFirst.mockResolvedValue({
        id: 'cl-7',
        email: 'test@example.com',
        passwordHash: 'hashed_pw',
        loginAttempts: 0,
        lockoutUntil: null,
      });
      queueAttempts(1, 1);
      mockPasswords.verify.mockResolvedValue(true);
      mockPrisma.client.update.mockResolvedValue({ id: 'cl-7' });

      await handler.execute({ email: 'test@example.com', password: 'SecurePass123' }, '9.9.9.9');

      // multi() opened once per key (email + ip).
      expect(mockRedisClient.multi).toHaveBeenCalledTimes(2);
      // Each pipeline chains incr then expire then exec.
      expect(multiIncr).toHaveBeenCalledWith('client_login:email:test@example.com');
      expect(multiIncr).toHaveBeenCalledWith('client_login:ip:9.9.9.9');
      expect(multiExpire).toHaveBeenCalledWith('client_login:email:test@example.com', 600);
      expect(multiExpire).toHaveBeenCalledWith('client_login:ip:9.9.9.9', 600);
      expect(multiExec).toHaveBeenCalledTimes(2);
      // The old non-atomic standalone INCR is gone.
      expect(mockRedisClient.incr).not.toHaveBeenCalled();
    });
  });
});
