import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus, ServiceUnavailableException } from '@nestjs/common';
import { OtpChannel } from '@prisma/client';
import { RequestDashboardOtpHandler } from './request-dashboard-otp.handler';
import { NotificationChannelRegistry } from '../../comms/notification-channel/notification-channel-registry';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { RedisService } from '../../../infrastructure/cache/redis.service';

describe('RequestDashboardOtpHandler', () => {
  let handler: RequestDashboardOtpHandler;
  let prismaMock: any;
  let channelRegistry: jest.Mocked<NotificationChannelRegistry>;
  let redisClient: { get: jest.Mock };

  const mockChannelService = {
    send: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    mockChannelService.send.mockReset().mockResolvedValue(undefined);

    redisClient = {
      get: jest.fn().mockResolvedValue(null),
    };

    prismaMock = {
      otpCode: {
        count: jest.fn().mockResolvedValue(0),
        delete: jest.fn().mockResolvedValue({ id: 'otp-1' }),
      },
      $transaction: jest.fn().mockImplementation(async (fn: any) =>
        fn({
          otpCode: {
            updateMany: jest.fn().mockResolvedValue({ count: 0 }),
            create: jest.fn().mockResolvedValue({ id: 'otp-1' }),
          },
        }),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RequestDashboardOtpHandler,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
        {
          provide: NotificationChannelRegistry,
          useValue: {
            resolve: jest.fn().mockReturnValue(mockChannelService),
          },
        },
        {
          provide: RlsTransactionService,
          useValue: {
            withTransaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) => prismaMock.$transaction(fn)),
            withBypassTransaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) => prismaMock.$transaction(fn)),
          },
        },
        {
          provide: RedisService,
          useValue: {
            getClient: jest.fn().mockReturnValue(redisClient),
          },
        },
      ],
    }).compile();

    handler = module.get<RequestDashboardOtpHandler>(RequestDashboardOtpHandler);
    channelRegistry = module.get(NotificationChannelRegistry);
  });

  it('email identifier → normalizes to lowercase, uses EMAIL channel, creates OTP and calls send', async () => {
    const result = await handler.execute({ identifier: 'User@Example.COM' });

    expect(result).toEqual({ success: true });

    // Normalized to lowercase for count query
    expect(prismaMock.otpCode.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ identifier: 'user@example.com' }),
      }),
    );

    // Resolved EMAIL channel
    expect(channelRegistry.resolve).toHaveBeenCalledWith(OtpChannel.EMAIL);
    // send called with normalized email
    expect(mockChannelService.send).toHaveBeenCalledWith('user@example.com', expect.any(String));
    // Sent code is 6-digit numeric string
    const sentCode = mockChannelService.send.mock.calls[0][1] as string;
    expect(sentCode).toMatch(/^\d{6}$/);
  });

  it('Saudi local phone 0512345678 → normalized to +966512345678, uses SMS channel, calls send', async () => {
    const result = await handler.execute({ identifier: '0512345678' });

    expect(result).toEqual({ success: true });

    expect(prismaMock.otpCode.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ identifier: '+966512345678' }),
      }),
    );

    expect(channelRegistry.resolve).toHaveBeenCalledWith(OtpChannel.SMS);
    expect(mockChannelService.send).toHaveBeenCalledWith('+966512345678', expect.any(String));
  });

  it('rate limit: when count >= 5, throws 429 Too Many Requests', async () => {
    prismaMock.otpCode.count.mockResolvedValue(5);

    await expect(handler.execute({ identifier: 'user@example.com' })).rejects.toThrow(HttpException);

    try {
      await handler.execute({ identifier: 'user@example.com' });
    } catch (err) {
      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    }
    // OTP should NOT be created when rate limited
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(mockChannelService.send).not.toHaveBeenCalled();
  });

  it('failed-verify lockout: when window counter >= max, refuses to issue a new OTP with 429', async () => {
    redisClient.get.mockResolvedValue('5');

    await expect(handler.execute({ identifier: 'user@example.com' })).rejects.toThrow(HttpException);

    try {
      await handler.execute({ identifier: 'user@example.com' });
    } catch (err) {
      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    }
    // No OTP row is created and nothing is sent — re-requesting must not reset the guess budget
    expect(prismaMock.otpCode.count).not.toHaveBeenCalled();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(mockChannelService.send).not.toHaveBeenCalled();
  });

  it('failed-verify lockout: counter is read under the normalized identifier', async () => {
    redisClient.get.mockResolvedValue('5');

    await expect(handler.execute({ identifier: 'User@Example.COM' })).rejects.toThrow(HttpException);

    expect(redisClient.get).toHaveBeenCalledWith('dashboard_otp:failed:user@example.com');
  });

  it('failed-verify lockout: counter below max does not block issuance', async () => {
    redisClient.get.mockResolvedValue('4');

    const result = await handler.execute({ identifier: 'user@example.com' });

    expect(result).toEqual({ success: true });
    expect(mockChannelService.send).toHaveBeenCalledTimes(1);
  });

  it('send failure → deletes the OTP row and throws ServiceUnavailableException', async () => {
    const txCreateMock = jest.fn().mockResolvedValue({ id: 'created-otp-id' });
    prismaMock.$transaction.mockImplementationOnce(async (fn: any) =>
      fn({
        otpCode: {
          updateMany: jest.fn().mockResolvedValue({ count: 0 }),
          create: txCreateMock,
        },
      }),
    );
    mockChannelService.send.mockRejectedValueOnce(new Error('SMS provider down'));

    await expect(handler.execute({ identifier: '0512345678' })).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );

    // The created row should be deleted on send failure
    expect(txCreateMock).toHaveBeenCalledTimes(1);
    expect(prismaMock.otpCode.delete).toHaveBeenCalledWith({ where: { id: 'created-otp-id' } });
  });
});
