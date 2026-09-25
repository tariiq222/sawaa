import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { BookingStatus, ProgramStatus, CancellationReason, RefundType } from '@prisma/client';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { stableEventId } from '../../../common/events';
import { CancelProgramHandler } from './cancel-program.handler';

/**
 * CancelProgram cascades the cancellation to every enrollment booking under
 * the program. It does NOT issue refunds — that's a manual per-invoice flow
 * handled by the refund-payment handler.
 *
 * Cascade events are staged in the transactional outbox (never published from
 * inside the transaction), so a rolled-back cascade cannot leave cancellation
 * notifications queued for bookings that stayed active.
 */
describe('CancelProgramHandler', () => {
  let handler: CancelProgramHandler;
  let prisma: any;
  let rls: { withTransaction: jest.Mock };

  const tx = () => prisma;

  const setup = () => {
    prisma = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      program: { findUnique: jest.fn(), update: jest.fn().mockResolvedValue({}) },
      programEnrollment: { findMany: jest.fn().mockResolvedValue([]) },
      booking: { update: jest.fn().mockResolvedValue({}) },
      bookingStatusLog: { create: jest.fn().mockResolvedValue({}) },
      outboxEvent: { create: jest.fn().mockResolvedValue({}) },
    };
    rls = { withTransaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(tx())) };
  };

  beforeEach(async () => {
    setup();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CancelProgramHandler,
        { provide: PrismaService, useValue: prisma },
        { provide: RlsTransactionService, useValue: rls },
      ],
    }).compile();

    handler = module.get<CancelProgramHandler>(CancelProgramHandler);
  });

  it('throws NotFoundException when the program does not exist', async () => {
    prisma.program.findUnique.mockResolvedValue(null);

    await expect(
      handler.execute('prog-missing', { reason: 'low enrollment' }),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.program.update).not.toHaveBeenCalled();
  });

  it('cancels a SCHEDULED program and resets enrolledCount to zero', async () => {
    prisma.program.findUnique.mockResolvedValue({
      id: 'prog-1',
      status: ProgramStatus.SCHEDULED,
    });
    prisma.programEnrollment.findMany.mockResolvedValue([]);

    const result = await handler.execute('prog-1', { reason: 'instructor sick' });

    expect(prisma.program.update).toHaveBeenCalledWith({
      where: { id: 'prog-1' },
      data: expect.objectContaining({
        status: ProgramStatus.CANCELLED,
        cancelReason: 'instructor sick',
        cancelledAt: expect.any(Date),
        enrolledCount: 0,
      }),
    });
    expect(result).toEqual({
      id: 'prog-1',
      status: ProgramStatus.CANCELLED,
      cancelledEnrollments: 0,
    });
  });

  it('cascades the cancellation to every active enrollment booking', async () => {
    prisma.program.findUnique.mockResolvedValue({
      id: 'prog-1',
      status: ProgramStatus.OPEN,
    });
    prisma.programEnrollment.findMany.mockResolvedValue([
      {
        bookingId: 'book-1',
        booking: {
          id: 'book-1',
          status: BookingStatus.CONFIRMED,
          clientId: 'client-1',
          employeeId: 'emp-1',
          scheduledAt: new Date('2026-05-01T10:00:00Z'),
          bookingNumber: 101,
        },
      },
      {
        bookingId: 'book-2',
        booking: {
          id: 'book-2',
          status: BookingStatus.PENDING,
          clientId: 'client-2',
          employeeId: 'emp-1',
          scheduledAt: new Date('2026-05-02T10:00:00Z'),
          bookingNumber: 102,
        },
      },
    ]);

    const result = await handler.execute('prog-1', { reason: 'venue unavailable' });

    expect(prisma.booking.update).toHaveBeenCalledTimes(2);
    expect(prisma.booking.update).toHaveBeenNthCalledWith(1, {
      where: { id: 'book-1' },
      data: expect.objectContaining({
        status: BookingStatus.CANCELLED,
        cancelReason: CancellationReason.SYSTEM_EXPIRED,
        cancelNotes: 'Program cancelled: venue unavailable',
        cancelledAt: expect.any(Date),
      }),
    });
    expect(prisma.booking.update).toHaveBeenNthCalledWith(2, {
      where: { id: 'book-2' },
      data: expect.objectContaining({
        status: BookingStatus.CANCELLED,
        cancelReason: CancellationReason.SYSTEM_EXPIRED,
      }),
    });

    // A status-log row is appended for every cascaded cancellation.
    expect(prisma.bookingStatusLog.create).toHaveBeenCalledTimes(2);
    expect(prisma.bookingStatusLog.create).toHaveBeenNthCalledWith(1, {
      data: expect.objectContaining({
        bookingId: 'book-1',
        fromStatus: BookingStatus.CONFIRMED,
        toStatus: BookingStatus.CANCELLED,
        changedBy: 'system:cancel-program',
        reason: 'Program cancelled: venue unavailable',
      }),
    });

    // And the cancelled count is reported back.
    expect(result.cancelledEnrollments).toBe(2);
  });

  it('locks the program row before snapshotting enrollments so a concurrent enrollment is included or rejected', async () => {
    prisma.program.findUnique.mockResolvedValue({
      id: 'prog-1',
      status: ProgramStatus.OPEN,
    });

    await handler.execute('prog-1', { reason: 'prevent enrollment race' });

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(prisma.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      prisma.programEnrollment.findMany.mock.invocationCallOrder[0],
    );
  });

  it('stages a BookingCancelledEvent in the transactional outbox for every cascaded booking', async () => {
    prisma.program.findUnique.mockResolvedValue({
      id: 'prog-1',
      status: ProgramStatus.OPEN,
    });
    prisma.programEnrollment.findMany.mockResolvedValue([
      {
        bookingId: 'book-1',
        booking: {
          id: 'book-1',
          status: BookingStatus.CONFIRMED,
          clientId: 'client-1',
          employeeId: 'emp-1',
          scheduledAt: new Date('2026-05-01T10:00:00Z'),
          bookingNumber: 101,
        },
      },
    ]);

    await handler.execute('prog-1', { reason: 'low enrollment' });

    expect(prisma.outboxEvent.create).toHaveBeenCalledTimes(1);
    expect(prisma.outboxEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        // Deterministic identity per (booking, program) so a replayed cancel
        // maps onto the same outbox row instead of a duplicate notification.
        id: stableEventId('booking:book-1:program-cancel:prog-1'),
        aggregateId: 'book-1',
        eventType: 'bookings.booking.cancelled',
        payload: expect.objectContaining({
          payload: expect.objectContaining({
            bookingId: 'book-1',
            bookingNumber: 101,
            clientId: 'client-1',
            employeeId: 'emp-1',
            reason: CancellationReason.SYSTEM_EXPIRED,
            cancelNotes: 'Program cancelled: low enrollment',
            refundType: RefundType.NONE,
            paymentId: null,
          }),
          source: 'bookings',
          version: 1,
        }),
      }),
    });
  });

  it('stages the event on the transaction client, so a rollback cannot emit a cancellation', async () => {
    prisma.program.findUnique.mockResolvedValue({
      id: 'prog-1',
      status: ProgramStatus.OPEN,
    });
    prisma.programEnrollment.findMany.mockResolvedValue([
      { bookingId: 'book-1', booking: { id: 'book-1', status: BookingStatus.CONFIRMED, clientId: 'c1', employeeId: 'e1', scheduledAt: new Date(), bookingNumber: 1 } },
    ]);

    let openTransactions = 0;
    let stagedInsideTransaction: boolean | null = null;
    rls.withTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      openTransactions += 1;
      try {
        return await fn(tx());
      } finally {
        openTransactions -= 1;
      }
    });
    prisma.outboxEvent.create.mockImplementation(async () => {
      stagedInsideTransaction = openTransactions > 0;
      return {};
    });

    await handler.execute('prog-1', { reason: 'rollback safety' });

    // Staged through the transaction client while the transaction is open: if
    // this transaction rolls back, the outbox row rolls back with it and the
    // publisher cron never sees a cancellation for a booking that stayed active.
    expect(stagedInsideTransaction).toBe(true);
    expect(openTransactions).toBe(0);
  });

  it('does not re-write history for already-terminal enrollment bookings', async () => {
    prisma.program.findUnique.mockResolvedValue({
      id: 'prog-1',
      status: ProgramStatus.OPEN,
    });
    prisma.programEnrollment.findMany.mockResolvedValue([
      // All three are terminal — the handler must not touch them.
      { bookingId: 'book-1', booking: { id: 'book-1', status: BookingStatus.CANCELLED, clientId: 'c1', employeeId: 'e1', scheduledAt: new Date(), bookingNumber: 1 } },
      { bookingId: 'book-2', booking: { id: 'book-2', status: BookingStatus.COMPLETED, clientId: 'c2', employeeId: 'e1', scheduledAt: new Date(), bookingNumber: 2 } },
      { bookingId: 'book-3', booking: { id: 'book-3', status: BookingStatus.NO_SHOW, clientId: 'c3', employeeId: 'e1', scheduledAt: new Date(), bookingNumber: 3 } },
      // One non-terminal — gets cancelled.
      { bookingId: 'book-4', booking: { id: 'book-4', status: BookingStatus.PENDING, clientId: 'c4', employeeId: 'e1', scheduledAt: new Date(), bookingNumber: 4 } },
    ]);

    const result = await handler.execute('prog-1', { reason: 'cascading test' });

    expect(prisma.booking.update).toHaveBeenCalledTimes(1);
    expect(prisma.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'book-4' } }),
    );
    expect(prisma.bookingStatusLog.create).toHaveBeenCalledTimes(1);
    expect(prisma.outboxEvent.create).toHaveBeenCalledTimes(1);
    expect(result.cancelledEnrollments).toBe(4);
  });

  it('runs the full cascade inside a single transaction', async () => {
    prisma.program.findUnique.mockResolvedValue({
      id: 'prog-1',
      status: ProgramStatus.SCHEDULED,
    });
    prisma.programEnrollment.findMany.mockResolvedValue([]);

    await handler.execute('prog-1', { reason: 'wrap in tx' });

    expect(rls.withTransaction).toHaveBeenCalledTimes(1);
  });
});
