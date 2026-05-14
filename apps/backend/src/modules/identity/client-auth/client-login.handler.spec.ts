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

  const mockRedisClient = {
    incr: jest.fn(),
    expire: jest.fn(),
    del: jest.fn(),
  };

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
      mockRedisClient.incr.mockResolvedValue(1);
      mockPasswords.verify.mockResolvedValue(true);
      mockPrisma.client.update.mockResolvedValue({ id: 'cl-1' });

      const result = await handler.execute(
        { email: 'test@example.com', password: 'SecurePass123' },
        '1.2.3.4',
      );

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
      mockRedisClient.incr.mockResolvedValue(2);
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
      mockRedisClient.incr.mockResolvedValue(5);
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
      mockRedisClient.incr
        .mockResolvedValueOnce(6)
        .mockResolvedValueOnce(1);

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
      mockRedisClient.incr
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(21);

      await expect(
        handler.execute({ email: 'test@example.com', password: 'WrongPass1' }, '5.5.5.5'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
