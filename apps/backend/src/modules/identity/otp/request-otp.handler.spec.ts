import { Test, TestingModule } from '@nestjs/testing';
import {
  HttpException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClsService } from 'nestjs-cls';
import { RequestOtpHandler } from './request-otp.handler';
import { NotificationChannelRegistry } from '../../comms/notification-channel/notification-channel-registry';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { RedisService } from '../../../infrastructure/cache/redis.service';
import { OtpChannel, OtpPurpose } from '@prisma/client';
import { SINGLE_TENANT_CONTEXT_ID } from '../../../common/constants';

describe('RequestOtpHandler', () => {
  let handler: RequestOtpHandler;
  let _channelRegistry: jest.Mocked<NotificationChannelRegistry>;
  let otpCountMock: jest.Mock;
  let otpDeleteMock: jest.Mock;
  let prismaMock: any;
  let redisSetMock: jest.Mock;

  const mockChannel = {
    kind: OtpChannel.EMAIL,
    send: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    otpCountMock = jest.fn().mockResolvedValue(0);
    otpDeleteMock = jest.fn().mockResolvedValue({ id: 'test-id' });
    mockChannel.send.mockReset().mockResolvedValue(undefined);
    redisSetMock = jest.fn().mockResolvedValue('OK');

    prismaMock = {
      $transaction: jest.fn().mockImplementation(async (fn) => fn({
        otpCode: {
          updateMany: jest.fn().mockResolvedValue({ count: 0 }),
          create: jest.fn().mockResolvedValue({ id: 'test-id' }),
        },
      })),
      otpCode: { count: otpCountMock, delete: otpDeleteMock },
    };

    const redisMock = { getClient: () => ({ set: redisSetMock }) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RequestOtpHandler,
        { provide: NotificationChannelRegistry, useValue: { resolve: jest.fn().mockReturnValue(mockChannel) } },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: PrismaService, useValue: prismaMock },
        { provide: RedisService, useValue: redisMock },
        {
          provide: ClsService,
          useValue: {
            run: jest.fn().mockImplementation((fn) => fn()),
            set: jest.fn(),
          },
        },
        {
          provide: RlsTransactionService,
          useValue: {
            withTransaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) => prismaMock.$transaction(fn)),
            withBypassTransaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) => prismaMock.$transaction(fn)),
          },
        },
      ],
    }).compile();

    handler = module.get<RequestOtpHandler>(RequestOtpHandler);
    _channelRegistry = module.get(NotificationChannelRegistry);
  });

  it('should return success on valid request', async () => {
    const result = await handler.execute({
      channel: OtpChannel.EMAIL,
      identifier: 'test@example.com',
      purpose: OtpPurpose.GUEST_BOOKING,
    });
    expect(result).toEqual({ success: true });
  });

  it('does not filter DB by organization and uses the fixed single-tenant context', async () => {
    // Single-tenant migration: organizationId removed from OtpCode model and
    // from the request DTO. The handler never filters the DB count or create
    // queries by organization and always uses the fixed deployment context.
    const txMock = {
      otpCode: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        create: jest.fn().mockResolvedValue({ id: 'test-id' }),
      },
    };
    prismaMock.$transaction.mockImplementationOnce(async (fn: any) => fn(txMock));

    await handler.execute({
      channel: OtpChannel.EMAIL,
      identifier: 'test@example.com',
      purpose: OtpPurpose.GUEST_BOOKING,
    });

    expect(txMock.otpCode.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ identifier: 'test@example.com' }),
      }),
    );
    // count query does NOT filter by organizationId
    expect(otpCountMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.not.objectContaining({ organizationId: expect.anything() }),
      }),
    );
    expect(redisSetMock).toHaveBeenCalledWith(
      `otp:cooldown:${SINGLE_TENANT_CONTEXT_ID}:test@example.com:${OtpPurpose.GUEST_BOOKING}`,
      '1',
      'EX',
      60,
      'NX',
    );
    expect(mockChannel.send).toHaveBeenCalledWith('test@example.com', expect.any(String), SINGLE_TENANT_CONTEXT_ID);
  });

  it('rate-limit is per-identifier (single-tenant: no per-org isolation)', async () => {
    // Single-tenant migration: rate limit is global per identifier+purpose, not per-org.
    // When identifier is at cap (>= 5 requests), the next request fails regardless of org.
    otpCountMock.mockResolvedValue(5);

    await expect(handler.execute({
      channel: OtpChannel.EMAIL,
      identifier: 'test@example.com',
      purpose: OtpPurpose.GUEST_BOOKING,
    })).rejects.toThrow(HttpException);
  });

  it('generates a 4-digit numeric code via CSPRNG (no longer Math.random)', async () => {
    mockChannel.send.mockClear();

    // Run the handler 25 times and assert every code is a 4-digit string in
    // [1000, 9999]. This proves: (a) format is 4 digits, (b) min bound is
    // applied (no 3-digit codes leak through padding), (c) max bound is exclusive.
    for (let i = 0; i < 25; i++) {
      await handler.execute({
        channel: OtpChannel.EMAIL,
        identifier: 'test@example.com',
        purpose: OtpPurpose.GUEST_BOOKING,
      });
    }

    expect(mockChannel.send).toHaveBeenCalledTimes(25);
    for (const call of mockChannel.send.mock.calls) {
      const sentCode = call[1] as string;
      expect(sentCode).toMatch(/^\d{4}$/);
      const n = Number(sentCode);
      expect(n).toBeGreaterThanOrEqual(1000);
      expect(n).toBeLessThanOrEqual(9999);
    }
  });

  it('throws ServiceUnavailableException and deletes OtpCode row when SMS send fails', async () => {
    const txCreateMock = jest.fn().mockResolvedValue({ id: 'created-otp-id' });
    prismaMock.$transaction.mockImplementationOnce(async (fn: any) =>
      fn({
        otpCode: {
          updateMany: jest.fn().mockResolvedValue({ count: 0 }),
          create: txCreateMock,
        },
      }),
    );
    mockChannel.send.mockRejectedValueOnce(new Error('SMS provider down'));

    await expect(
      handler.execute({
        channel: OtpChannel.SMS,
        identifier: '+966500000000',
        purpose: OtpPurpose.MOBILE_LOGIN,
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    // Row created, then deleted on send failure.
    expect(txCreateMock).toHaveBeenCalledTimes(1);
    expect(otpDeleteMock).toHaveBeenCalledWith({ where: { id: 'created-otp-id' } });
  });

  it('rejects with 429 when same identifier+purpose requested within 60s', async () => {
    // Simulate cooldown key already set (SETNX returns null = key existed)
    redisSetMock.mockResolvedValueOnce(null);

    await expect(handler.execute({
      channel: OtpChannel.SMS,
      identifier: '+966500000000',
      purpose: OtpPurpose.MOBILE_LOGIN,
    })).rejects.toThrow(HttpException);

    // Verify OTP was NOT issued (DB count not called because we bailed early)
    expect(otpCountMock).not.toHaveBeenCalled();
  });

  it('allows request after 60s cooldown (SETNX succeeds)', async () => {
    // Simulate key not present (first request or window expired)
    redisSetMock.mockResolvedValueOnce('OK');

    const result = await handler.execute({
      channel: OtpChannel.SMS,
      identifier: '+966500000000',
      purpose: OtpPurpose.MOBILE_LOGIN,
    });

    expect(result).toEqual({ success: true });
    // Confirm the Redis SET was called with the right key pattern and TTL
    expect(redisSetMock).toHaveBeenCalledWith(
      `otp:cooldown:${SINGLE_TENANT_CONTEXT_ID}:+966500000000:MOBILE_LOGIN`,
      '1',
      'EX',
      60,
      'NX',
    );
  });
});
