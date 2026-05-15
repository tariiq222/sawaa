import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { BookingStatus, ZoomMeetingStatus, Prisma } from '@prisma/client';
import { CreateZoomMeetingHandler } from './create-zoom-meeting.handler';
import { PrismaService } from '../../../infrastructure/database';
import { ZoomApiClient } from '../../../infrastructure/zoom/zoom-api.client';
import { ZoomCredentialsService } from '../../../infrastructure/zoom/zoom-credentials.service';

const buildPrisma = () => ({
  booking: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  integration: {
    findFirst: jest.fn(),
  },
  organizationSettings: {
    findFirst: jest.fn(),
  },
  $executeRaw: jest.fn().mockResolvedValue(undefined),
});

describe('CreateZoomMeetingHandler', () => {
  let handler: CreateZoomMeetingHandler;
  let prisma: ReturnType<typeof buildPrisma>;
  let zoomApi: jest.Mocked<Partial<ZoomApiClient>>;
  let zoomCredentials: jest.Mocked<Partial<ZoomCredentialsService>>;
  let txMock: ReturnType<typeof buildPrisma>;

  beforeEach(async () => {
    prisma = buildPrisma();
    txMock = buildPrisma();

    prisma.$transaction = jest
      .fn()
      .mockImplementation(async (fn: (tx: typeof txMock) => Promise<unknown>) => fn(txMock));

    zoomApi = {
      getAccessToken: jest.fn().mockResolvedValue('token'),
      createMeeting: jest.fn().mockResolvedValue({
        id: 12345,
        join_url: 'https://zoom.us/j/12345',
        start_url: 'https://zoom.us/s/12345',
      }),
    };

    zoomCredentials = {
      decrypt: jest.fn().mockReturnValue({
        zoomClientId: 'client-id',
        zoomClientSecret: 'client-secret',
        zoomAccountId: 'account-id',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateZoomMeetingHandler,
        { provide: PrismaService, useValue: prisma },
        { provide: ZoomApiClient, useValue: zoomApi },
        { provide: ZoomCredentialsService, useValue: zoomCredentials },
      ],
    }).compile();

    handler = module.get<CreateZoomMeetingHandler>(CreateZoomMeetingHandler);
  });

  const bookingBase = {
    id: 'booking-1',
    bookingType: 'ONLINE' as const,
    scheduledAt: new Date('2026-06-01T10:00:00Z'),
    durationMins: 60,
    zoomMeetingId: null,
    zoomMeetingStatus: null,
    status: BookingStatus.PENDING,
    clientId: 'client-1',
    employeeId: 'emp-1',
    branchId: 'branch-1',
    serviceId: 'svc-1',
    invoiceId: 'inv-1',
    paymentId: null,
    couponCode: null,
    source: 'dashboard' as const,
    createdAt: new Date(),
    updatedAt: new Date(),
    notes: null,
    cancelledAt: null,
    cancelledBy: null,
    cancellationReason: null,
    isRecurring: false,
    recurringGroupId: null,
    groupSessionId: null,
    isGroup: false,
    rescheduledCount: 0,
    maxReschedules: null,
    zoomJoinUrl: null,
    zoomHostUrl: null,
    zoomStartUrl: null,
    zoomMeetingCreatedAt: null,
    zoomMeetingError: null,
  };

  it('should throw NotFoundException when booking not found', async () => {
    prisma.booking.findFirst.mockResolvedValue(null);
    await expect(handler.execute({ bookingId: 'missing' })).rejects.toThrow(NotFoundException);
  });

  it('should throw BadRequestException when booking type is not ONLINE', async () => {
    prisma.booking.findFirst.mockResolvedValue({ ...bookingBase, bookingType: 'IN_PERSON' });
    await expect(handler.execute({ bookingId: bookingBase.id })).rejects.toThrow(BadRequestException);
  });

  it('should throw NotFoundException when booking not found inside tx', async () => {
    prisma.booking.findFirst.mockResolvedValue(bookingBase);
    txMock.booking.findFirst.mockResolvedValue(null);

    await expect(handler.execute({ bookingId: bookingBase.id })).rejects.toThrow(NotFoundException);
  });

  it('should return existing booking when zoom meeting already created', async () => {
    const existing = {
      ...bookingBase,
      zoomMeetingId: '12345',
      zoomMeetingStatus: ZoomMeetingStatus.CREATED,
    };
    prisma.booking.findFirst.mockResolvedValue(existing);
    txMock.booking.findFirst.mockResolvedValue(existing);

    const result = await handler.execute({ bookingId: bookingBase.id });
    expect(result).toEqual(existing);
    expect(txMock.booking.update).not.toHaveBeenCalled();
  });

  it('should mark FAILED when Zoom integration not configured', async () => {
    prisma.booking.findFirst.mockResolvedValue(bookingBase);
    txMock.booking.findFirst.mockResolvedValue(bookingBase);
    txMock.integration.findFirst.mockResolvedValue(null);

    const updated = { ...bookingBase, zoomMeetingStatus: ZoomMeetingStatus.FAILED };
    txMock.booking.update.mockResolvedValue(updated);

    const result = await handler.execute({ bookingId: bookingBase.id });
    expect(txMock.booking.update).toHaveBeenCalledWith({
      where: { id: bookingBase.id },
      data: {
        zoomMeetingStatus: ZoomMeetingStatus.FAILED,
        zoomMeetingError: 'Zoom integration is not configured for this clinic',
      },
    });
    expect(result.zoomMeetingStatus).toBe(ZoomMeetingStatus.FAILED);
  });

  it('should mark FAILED when Zoom integration is inactive', async () => {
    prisma.booking.findFirst.mockResolvedValue(bookingBase);
    txMock.booking.findFirst.mockResolvedValue(bookingBase);
    txMock.integration.findFirst.mockResolvedValue({ id: 'int-1', provider: 'zoom', isActive: false, config: {} });

    const updated = { ...bookingBase, zoomMeetingStatus: ZoomMeetingStatus.FAILED };
    txMock.booking.update.mockResolvedValue(updated);

    const result = await handler.execute({ bookingId: bookingBase.id });
    expect(txMock.booking.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ zoomMeetingStatus: ZoomMeetingStatus.FAILED }),
    }));
  });

  it('should mark FAILED when ciphertext is missing', async () => {
    prisma.booking.findFirst.mockResolvedValue(bookingBase);
    txMock.booking.findFirst.mockResolvedValue(bookingBase);
    txMock.integration.findFirst.mockResolvedValue({ id: 'int-1', provider: 'zoom', isActive: true, config: {} });

    const updated = { ...bookingBase, zoomMeetingStatus: ZoomMeetingStatus.FAILED };
    txMock.booking.update.mockResolvedValue(updated);

    const result = await handler.execute({ bookingId: bookingBase.id });
    expect(txMock.booking.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        zoomMeetingStatus: ZoomMeetingStatus.FAILED,
        zoomMeetingError: 'Zoom integration configuration is invalid',
      }),
    }));
  });

  it('should create Zoom meeting successfully', async () => {
    prisma.booking.findFirst.mockResolvedValue(bookingBase);
    txMock.booking.findFirst.mockResolvedValue(bookingBase);
    txMock.integration.findFirst.mockResolvedValue({
      id: 'int-1',
      provider: 'zoom',
      isActive: true,
      config: { ciphertext: 'encrypted-data' },
    });
    txMock.organizationSettings.findFirst.mockResolvedValue({ timezone: 'Asia/Dubai' });

    const updated = {
      ...bookingBase,
      zoomMeetingId: '12345',
      zoomJoinUrl: 'https://zoom.us/j/12345',
      zoomHostUrl: 'https://zoom.us/s/12345',
      zoomStartUrl: 'https://zoom.us/s/12345',
      zoomMeetingStatus: ZoomMeetingStatus.CREATED,
    };
    txMock.booking.update.mockResolvedValue(updated);

    const result = await handler.execute({ bookingId: bookingBase.id });

    expect(zoomApi.getAccessToken).toHaveBeenCalledWith(expect.any(String), 'client-id', 'client-secret', 'account-id');
    expect(zoomApi.createMeeting).toHaveBeenCalledWith(
      'token',
      expect.objectContaining({ topic: `Booking ${bookingBase.id}`, durationMins: 60 }),
      'Asia/Dubai',
    );
    expect(txMock.booking.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        zoomMeetingId: '12345',
        zoomMeetingStatus: ZoomMeetingStatus.CREATED,
        zoomMeetingError: null,
      }),
    }));
    expect(result.zoomMeetingStatus).toBe(ZoomMeetingStatus.CREATED);
  });

  it('should use default timezone when settings not found', async () => {
    prisma.booking.findFirst.mockResolvedValue(bookingBase);
    txMock.booking.findFirst.mockResolvedValue(bookingBase);
    txMock.integration.findFirst.mockResolvedValue({
      id: 'int-1',
      provider: 'zoom',
      isActive: true,
      config: { ciphertext: 'encrypted-data' },
    });
    txMock.organizationSettings.findFirst.mockResolvedValue(null);

    const updated = {
      ...bookingBase,
      zoomMeetingId: '12345',
      zoomJoinUrl: 'https://zoom.us/j/12345',
      zoomHostUrl: 'https://zoom.us/s/12345',
      zoomStartUrl: 'https://zoom.us/s/12345',
      zoomMeetingStatus: ZoomMeetingStatus.CREATED,
    };
    txMock.booking.update.mockResolvedValue(updated);

    await handler.execute({ bookingId: bookingBase.id });
    expect(zoomApi.createMeeting).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'Asia/Riyadh');
  });

  it('should mark FAILED when Zoom API throws', async () => {
    prisma.booking.findFirst.mockResolvedValue(bookingBase);
    txMock.booking.findFirst.mockResolvedValue(bookingBase);
    txMock.integration.findFirst.mockResolvedValue({
      id: 'int-1',
      provider: 'zoom',
      isActive: true,
      config: { ciphertext: 'encrypted-data' },
    });
    txMock.organizationSettings.findFirst.mockResolvedValue(null);

    zoomApi.createMeeting.mockRejectedValue(new Error('Zoom API error'));

    const updated = { ...bookingBase, zoomMeetingStatus: ZoomMeetingStatus.FAILED };
    txMock.booking.update.mockResolvedValue(updated);

    const result = await handler.execute({ bookingId: bookingBase.id });
    expect(txMock.booking.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        zoomMeetingStatus: ZoomMeetingStatus.FAILED,
        zoomMeetingError: 'Zoom API error',
      }),
    }));
    expect(result.zoomMeetingStatus).toBe(ZoomMeetingStatus.FAILED);
  });

  it('should handle non-Error thrown in catch block', async () => {
    prisma.booking.findFirst.mockResolvedValue(bookingBase);
    txMock.booking.findFirst.mockResolvedValue(bookingBase);
    txMock.integration.findFirst.mockResolvedValue({
      id: 'int-1',
      provider: 'zoom',
      isActive: true,
      config: { ciphertext: 'encrypted-data' },
    });
    txMock.organizationSettings.findFirst.mockResolvedValue(null);

    zoomApi.createMeeting.mockRejectedValue('string-error');

    const updated = { ...bookingBase, zoomMeetingStatus: ZoomMeetingStatus.FAILED };
    txMock.booking.update.mockResolvedValue(updated);

    await handler.execute({ bookingId: bookingBase.id });
    expect(txMock.booking.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ zoomMeetingError: 'Unknown error' }),
    }));
  });
});
