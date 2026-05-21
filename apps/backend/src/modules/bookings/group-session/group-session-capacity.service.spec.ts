import { Test, TestingModule } from '@nestjs/testing';
import { BookingStatus } from '@prisma/client';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { GroupSessionCapacityService } from './group-session-capacity.service';

describe('GroupSessionCapacityService — recalculateGroupStatus', () => {
  let service: GroupSessionCapacityService;
  let tx: any;

  beforeEach(async () => {
    tx = {
      booking: {
        findMany: jest.fn(),
        updateMany: jest.fn(),
      },
      bookingStatusLog: {
        create: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GroupSessionCapacityService,
        {
          provide: PrismaService,
          useValue: {},
        },
        {
          provide: RlsTransactionService,
          useValue: {
            withTransaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn(tx)),
          },
        },
      ],
    }).compile();

    service = module.get<GroupSessionCapacityService>(GroupSessionCapacityService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('is a no-op when no AWAITING_PAYMENT bookings exist for the group session', async () => {
    tx.booking.findMany.mockResolvedValue([]);

    await service.recalculateGroupStatus(tx, 'gs-1');

    expect(tx.booking.updateMany).not.toHaveBeenCalled();
    expect(tx.bookingStatusLog.create).not.toHaveBeenCalled();
  });

  it('rolls back all AWAITING_PAYMENT bookings to PENDING_GROUP_FILL when any remain', async () => {
    // Scenario: 10 bookings were in AWAITING_PAYMENT (min reached), 1 cancels.
    // The remaining 9 AWAITING_PAYMENT bookings must roll back.
    const awaitingBookings = [
      { id: 'b1' }, { id: 'b2' }, { id: 'b3' }, { id: 'b4' }, { id: 'b5' },
      { id: 'b6' }, { id: 'b7' }, { id: 'b8' }, { id: 'b9' },
    ];
    tx.booking.findMany.mockResolvedValue(awaitingBookings);
    tx.booking.updateMany.mockResolvedValue({ count: 9 });
    tx.bookingStatusLog.create.mockResolvedValue({});

    await service.recalculateGroupStatus(tx, 'gs-1');

    expect(tx.booking.findMany).toHaveBeenCalledWith({
      where: { groupSessionId: 'gs-1', status: BookingStatus.AWAITING_PAYMENT },
      select: { id: true },
    });

    expect(tx.booking.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7', 'b8', 'b9'] } },
      data: {
        status: BookingStatus.PENDING_GROUP_FILL,
        expiresAt: null,
      },
    });

    // A status log entry for each rolled-back booking
    expect(tx.bookingStatusLog.create).toHaveBeenCalledTimes(9);
    expect(tx.bookingStatusLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          fromStatus: BookingStatus.AWAITING_PAYMENT,
          toStatus: BookingStatus.PENDING_GROUP_FILL,
          changedBy: 'system',
        }),
      }),
    );
  });

  it('handles a single remaining AWAITING_PAYMENT booking (edge case)', async () => {
    tx.booking.findMany.mockResolvedValue([{ id: 'b1' }]);
    tx.booking.updateMany.mockResolvedValue({ count: 1 });
    tx.bookingStatusLog.create.mockResolvedValue({});

    await service.recalculateGroupStatus(tx, 'gs-2');

    expect(tx.booking.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ['b1'] } },
        data: expect.objectContaining({ status: BookingStatus.PENDING_GROUP_FILL }),
      }),
    );
    expect(tx.bookingStatusLog.create).toHaveBeenCalledTimes(1);
  });

  it('clears expiresAt when rolling back to PENDING_GROUP_FILL', async () => {
    tx.booking.findMany.mockResolvedValue([{ id: 'b1' }, { id: 'b2' }]);
    tx.booking.updateMany.mockResolvedValue({ count: 2 });
    tx.bookingStatusLog.create.mockResolvedValue({});

    await service.recalculateGroupStatus(tx, 'gs-3');

    expect(tx.booking.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ expiresAt: null }),
      }),
    );
  });

  it('queries only the correct groupSessionId', async () => {
    tx.booking.findMany.mockResolvedValue([]);

    await service.recalculateGroupStatus(tx, 'gs-specific-id');

    expect(tx.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ groupSessionId: 'gs-specific-id' }),
      }),
    );
  });
});
