import { Test, TestingModule } from '@nestjs/testing';
import { BookingStatus, PaymentStatus } from '@prisma/client';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { GroupSessionCapacityService } from './group-session-capacity.service';

describe('GroupSessionCapacityService — recalculateGroupStatus', () => {
  let service: GroupSessionCapacityService;
  let tx: any;

  beforeEach(async () => {
    tx = {
      booking: {
        count: jest.fn(),
        findMany: jest.fn(),
        updateMany: jest.fn(),
      },
      invoice: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      groupSession: {
        updateMany: jest.fn(),
        findUnique: jest.fn(),
      },
      service: {
        findUnique: jest.fn(),
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
    tx.groupSession.findUnique.mockResolvedValue({ serviceId: 'svc-1' });
    tx.service.findUnique.mockResolvedValue({ minParticipants: 2 });
    tx.booking.count.mockResolvedValue(1);
    tx.booking.findMany.mockResolvedValue([]);

    await service.recalculateGroupStatus(tx, 'gs-1');

    expect(tx.groupSession.updateMany).toHaveBeenCalledWith({
      where: { id: 'gs-1', enrolledCount: { gt: 0 } },
      data: { enrolledCount: { decrement: 1 } },
    });
    expect(tx.booking.updateMany).not.toHaveBeenCalled();
    expect(tx.bookingStatusLog.create).not.toHaveBeenCalled();
  });

  it('rolls back AWAITING_PAYMENT bookings when active count is below service minimum', async () => {
    tx.groupSession.findUnique.mockResolvedValue({ serviceId: 'svc-1' });
    tx.service.findUnique.mockResolvedValue({ minParticipants: 10 });
    tx.booking.count.mockResolvedValue(9);
    const awaitingBookings = [
      { id: 'b1' }, { id: 'b2' }, { id: 'b3' }, { id: 'b4' }, { id: 'b5' },
      { id: 'b6' }, { id: 'b7' }, { id: 'b8' }, { id: 'b9' },
    ];
    tx.booking.findMany.mockResolvedValue(awaitingBookings);
    tx.booking.updateMany.mockResolvedValue({ count: 9 });
    tx.bookingStatusLog.create.mockResolvedValue({});

    await service.recalculateGroupStatus(tx, 'gs-1');

    expect(tx.booking.count).toHaveBeenCalledWith({
      where: {
        groupSessionId: 'gs-1',
        status: {
          in: [
            BookingStatus.PENDING_GROUP_FILL,
            BookingStatus.AWAITING_PAYMENT,
            BookingStatus.CONFIRMED,
          ],
        },
      },
    });
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

  it('does NOT roll back a booking that already collected a deposit (COMPLETED payment), only the unpaid one', async () => {
    tx.groupSession.findUnique.mockResolvedValue({ serviceId: 'svc-1' });
    tx.service.findUnique.mockResolvedValue({ minParticipants: 5 });
    tx.booking.count.mockResolvedValue(2); // below minimum -> rollback path
    tx.booking.findMany.mockResolvedValue([{ id: 'b-paid' }, { id: 'b-unpaid' }]);
    // The new money-safety query: invoices keyed by bookingId that carry a
    // COMPLETED payment. b-paid has a deposit; b-unpaid does not.
    tx.invoice.findMany.mockResolvedValue([{ bookingId: 'b-paid' }]);
    tx.booking.updateMany.mockResolvedValue({ count: 1 });
    tx.bookingStatusLog.create.mockResolvedValue({});

    await service.recalculateGroupStatus(tx, 'gs-money');

    // The invoice lookup matches the actual Prisma query shape (bookingId in [...]
    // filtered by a COMPLETED payment via the payments relation).
    expect(tx.invoice.findMany).toHaveBeenCalledWith({
      where: {
        bookingId: { in: ['b-paid', 'b-unpaid'] },
        payments: { some: { status: PaymentStatus.COMPLETED } },
      },
      select: { bookingId: true },
    });

    // Only the unpaid booking is rolled back — never the deposit-paid one.
    expect(tx.booking.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.booking.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['b-unpaid'] } },
      data: {
        status: BookingStatus.PENDING_GROUP_FILL,
        expiresAt: null,
      },
    });
    // b-paid must never appear in any updateMany rollback set.
    const rolledBackIds: string[] = tx.booking.updateMany.mock.calls.flatMap(
      (call: [{ where: { id: { in: string[] } } }]) => call[0].where.id.in,
    );
    expect(rolledBackIds).toEqual(['b-unpaid']);
    expect(rolledBackIds).not.toContain('b-paid');

    // The unpaid booking gets the normal rollback log (AWAITING_PAYMENT -> PENDING_GROUP_FILL).
    expect(tx.bookingStatusLog.create).toHaveBeenCalledWith({
      data: {
        bookingId: 'b-unpaid',
        fromStatus: BookingStatus.AWAITING_PAYMENT,
        toStatus: BookingStatus.PENDING_GROUP_FILL,
        changedBy: 'system',
        reason:
          'Group session capacity dropped below threshold after participant cancellation',
      },
    });

    // The deposit-paid booking gets a staff-attention log: stays AWAITING_PAYMENT
    // (from === to), changedBy system, reason flags manual intervention.
    expect(tx.bookingStatusLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        bookingId: 'b-paid',
        fromStatus: BookingStatus.AWAITING_PAYMENT,
        toStatus: BookingStatus.AWAITING_PAYMENT,
        changedBy: 'system',
        reason: expect.stringContaining('manual'),
      }),
    });

    // Exactly two log entries: one rollback + one staff-attention flag.
    expect(tx.bookingStatusLog.create).toHaveBeenCalledTimes(2);
  });

  it('does not roll back when active count still meets service minimum', async () => {
    tx.groupSession.findUnique.mockResolvedValue({ serviceId: 'svc-1' });
    tx.service.findUnique.mockResolvedValue({ minParticipants: 2 });
    tx.booking.count.mockResolvedValue(2);

    await service.recalculateGroupStatus(tx, 'gs-2');

    expect(tx.booking.findMany).not.toHaveBeenCalled();
    expect(tx.booking.updateMany).not.toHaveBeenCalled();
    expect(tx.bookingStatusLog.create).not.toHaveBeenCalled();
  });

  it('clears expiresAt when rolling back to PENDING_GROUP_FILL', async () => {
    tx.groupSession.findUnique.mockResolvedValue({ serviceId: 'svc-1' });
    tx.service.findUnique.mockResolvedValue({ minParticipants: 3 });
    tx.booking.count.mockResolvedValue(2);
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
    tx.groupSession.findUnique.mockResolvedValue({ serviceId: 'svc-1' });
    tx.service.findUnique.mockResolvedValue({ minParticipants: 2 });
    tx.booking.count.mockResolvedValue(1);
    tx.booking.findMany.mockResolvedValue([]);

    await service.recalculateGroupStatus(tx, 'gs-specific-id');

    expect(tx.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ groupSessionId: 'gs-specific-id' }),
      }),
    );
  });

  it('skips rollback after decrement when service is missing', async () => {
    tx.groupSession.findUnique.mockResolvedValue({ serviceId: 'missing-service' });
    tx.service.findUnique.mockResolvedValue(null);

    await service.recalculateGroupStatus(tx, 'gs-4');

    expect(tx.groupSession.updateMany).toHaveBeenCalledWith({
      where: { id: 'gs-4', enrolledCount: { gt: 0 } },
      data: { enrolledCount: { decrement: 1 } },
    });
    expect(tx.booking.count).not.toHaveBeenCalled();
    expect(tx.booking.findMany).not.toHaveBeenCalled();
    expect(tx.booking.updateMany).not.toHaveBeenCalled();
  });
});
