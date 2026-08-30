import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BookingStatus, BookingType, PackageCreditUsageStatus, ProgramStatus } from '@prisma/client';
import { RestoreNoShowBookingHandler } from './restore-no-show-booking.handler';
import { buildPrisma, buildRlsTransaction, mockBooking } from '../testing/booking-test-helpers';

const newHandler = (prisma: ReturnType<typeof buildPrisma>) =>
  new RestoreNoShowBookingHandler(
    prisma as never,
    buildRlsTransaction(prisma) as never,
  );

describe('RestoreNoShowBookingHandler', () => {
  it('restores a NO_SHOW booking to CONFIRMED, sets checkedInAt and clears noShowAt', async () => {
    const prisma = buildPrisma();
    prisma.booking.findUnique = jest.fn().mockResolvedValue({
      ...mockBooking,
      status: BookingStatus.NO_SHOW,
      checkedInAt: null,
      noShowAt: new Date(),
    });
    await newHandler(prisma).execute({
      bookingId: 'book-1',
      changedBy: 'user-42',
      reason: 'Client arrived 5 min late; auto-no-show fired in error',
    });

    expect(prisma.booking.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: BookingStatus.CONFIRMED,
          checkedInAt: expect.any(Date),
          noShowAt: null,
        }),
      }),
    );
  });

  it('throws BadRequestException when booking is not NO_SHOW', async () => {
    const prisma = buildPrisma();
    prisma.booking.findUnique = jest.fn().mockResolvedValue({
      ...mockBooking,
      status: BookingStatus.CONFIRMED,
    });
    await expect(
      newHandler(prisma).execute({
        bookingId: 'book-1',
        changedBy: 'user-42',
        reason: 'Should not reach this handler',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when booking is COMPLETED (terminal, no audit escape)', async () => {
    const prisma = buildPrisma();
    prisma.booking.findUnique = jest.fn().mockResolvedValue({
      ...mockBooking,
      status: BookingStatus.COMPLETED,
    });
    await expect(
      newHandler(prisma).execute({
        bookingId: 'book-1',
        changedBy: 'user-42',
        reason: 'Should not reach this handler',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws NotFoundException when booking is not found', async () => {
    const prisma = buildPrisma();
    prisma.booking.findUnique = jest.fn().mockResolvedValue(null);
    await expect(
      newHandler(prisma).execute({
        bookingId: 'bad',
        changedBy: 'user-42',
        reason: 'irrelevant reason text',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejects a reason shorter than 3 characters after trimming', async () => {
    const prisma = buildPrisma();
    await expect(
      newHandler(prisma).execute({
        bookingId: 'book-1',
        changedBy: 'user-42',
        reason: '  a  ',
      }),
    ).rejects.toThrow(BadRequestException);
  });
});

describe('RestoreNoShowBookingHandler — status log', () => {
  it('writes a BookingStatusLog row with from=NO_SHOW, to=CONFIRMED, changedBy and the prefixed reason', async () => {
    const prisma = buildPrisma();
    prisma.booking.findUnique.mockResolvedValue({
      ...mockBooking,
      status: BookingStatus.NO_SHOW,
      noShowAt: new Date(),
    });
    const handler = newHandler(prisma);

    await handler.execute({
      bookingId: 'book-1',
      changedBy: 'admin-1',
      reason: '  auto-no-show fired too early  ',
    });

    expect(prisma.bookingStatusLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        fromStatus: BookingStatus.NO_SHOW,
        toStatus: BookingStatus.CONFIRMED,
        changedBy: 'admin-1',
        reason: 'Restored from no-show: auto-no-show fired too early',
      }),
    });
  });
});

describe('RestoreNoShowBookingHandler — financial consequence (no-show forfeit stands)', () => {
  it('does NOT mutate any payment and does NOT create any refund on restore', async () => {
    const prisma = buildPrisma();
    const refundCreate = jest.fn();
    const paymentUpdate = jest.fn();
    (prisma as unknown as Record<string, unknown>).refundRequest = { create: refundCreate };
    (prisma.payment as unknown as Record<string, unknown>).update = paymentUpdate;
    prisma.booking.findUnique = jest.fn().mockResolvedValue({
      ...mockBooking,
      status: BookingStatus.NO_SHOW,
      noShowAt: new Date(),
    });

    await newHandler(prisma).execute({
      bookingId: 'book-1',
      changedBy: 'system',
      reason: 'restore test',
    });

    expect(refundCreate).not.toHaveBeenCalled();
    expect(paymentUpdate).not.toHaveBeenCalled();
  });
});

describe('RestoreNoShowBookingHandler — package credit reclaim', () => {
  function withProgramStubs(prisma: ReturnType<typeof buildPrisma>) {
    (prisma as unknown as Record<string, unknown>).program = {
      findUnique: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    };
    (prisma as unknown as Record<string, unknown>).programEnrollment = {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    };
  }

  it('re-claims a RETURNED credit (usage → CONSUMED + bucket usedQuantity incremented)', async () => {
    const prisma = buildPrisma();
    withProgramStubs(prisma);
    prisma.booking.findUnique = jest.fn().mockResolvedValue({
      ...mockBooking,
      status: BookingStatus.NO_SHOW,
      packageCreditId: 'credit-1',
    });
    // Reclaim helper expects: a RETURNED usage row + credit with capacity left.
    (prisma as unknown as { packageCreditUsage: { findFirst: jest.Mock } })
      .packageCreditUsage.findFirst
      .mockResolvedValueOnce({ id: 'usage-1', creditId: 'credit-1' });
    (prisma as unknown as { packageCredit: { findUnique: jest.Mock } })
      .packageCredit.findUnique
      .mockResolvedValueOnce({ id: 'credit-1', totalQuantity: 10, usedQuantity: 3 });

    await newHandler(prisma).execute({
      bookingId: 'book-1',
      changedBy: 'user-42',
      reason: 're-credit restore',
    });

    expect((prisma as any).packageCreditUsage.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: PackageCreditUsageStatus.CONSUMED,
          returnedAt: null,
        }),
      }),
    );
    expect((prisma as any).packageCredit.update).toHaveBeenCalledWith({
      where: { id: 'credit-1' },
      data: { usedQuantity: { increment: 1 } },
    });
  });

  it('rolls back the restore when the credit bucket is full (BadRequestException)', async () => {
    const prisma = buildPrisma();
    withProgramStubs(prisma);
    prisma.booking.findUnique = jest.fn().mockResolvedValue({
      ...mockBooking,
      status: BookingStatus.NO_SHOW,
      packageCreditId: 'credit-1',
    });
    (prisma as unknown as { packageCreditUsage: { findFirst: jest.Mock } })
      .packageCreditUsage.findFirst
      .mockResolvedValueOnce({ id: 'usage-1', creditId: 'credit-1' });
    (prisma as unknown as { packageCredit: { findUnique: jest.Mock } })
      .packageCredit.findUnique
      .mockResolvedValueOnce({ id: 'credit-1', totalQuantity: 10, usedQuantity: 10 });

    await expect(
      newHandler(prisma).execute({
        bookingId: 'book-1',
        changedBy: 'user-42',
        reason: 'bucket is full',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('does NOT touch credit models when the booking has no packageCreditId', async () => {
    const prisma = buildPrisma();
    withProgramStubs(prisma);
    prisma.booking.findUnique = jest.fn().mockResolvedValue({
      ...mockBooking,
      status: BookingStatus.NO_SHOW,
      packageCreditId: null,
    });

    await newHandler(prisma).execute({
      bookingId: 'book-1',
      changedBy: 'user-42',
      reason: 'no credit here',
    });

    expect((prisma as any).packageCreditUsage.findFirst).not.toHaveBeenCalled();
    expect((prisma as any).packageCredit.update).not.toHaveBeenCalled();
  });
});

describe('RestoreNoShowBookingHandler — program enrollment', () => {
  function withProgramStubs(
    prisma: ReturnType<typeof buildPrisma>,
    options: {
      existingEnrollment?: boolean;
      programMissing?: boolean;
      programFull?: boolean;
      programCancelled?: boolean;
    } = {},
  ) {
    (prisma as unknown as { $queryRaw: jest.Mock }).$queryRaw = jest
      .fn()
      .mockResolvedValue([]);
    (prisma as unknown as Record<string, unknown>).program = {
      findUnique: jest.fn().mockImplementation(() => {
        if (options.programMissing) return Promise.resolve(null);
        return Promise.resolve(
          options.programFull
            ? { status: ProgramStatus.SCHEDULED, maxParticipants: 10, enrolledCount: 10 }
            : {
                status: options.programCancelled ? ProgramStatus.CANCELLED : ProgramStatus.SCHEDULED,
                maxParticipants: 10,
                enrolledCount: 3,
              },
        );
      }),
      updateMany: jest.fn().mockResolvedValue({ count: options.programFull ? 0 : 1 }),
    };
    (prisma as unknown as Record<string, unknown>).programEnrollment = {
      findUnique: jest.fn().mockResolvedValue(
        options.existingEnrollment
          ? { id: 'enr-1', programId: 'prog-1', clientId: 'client-1' }
          : null,
      ),
      create: jest.fn().mockResolvedValue({ id: 'enr-new' }),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    };
  }

  it('re-enrolls a program booking when the program has free seats', async () => {
    const prisma = buildPrisma();
    withProgramStubs(prisma);
    prisma.booking.findUnique = jest.fn().mockResolvedValue({
      ...mockBooking,
      status: BookingStatus.NO_SHOW,
      programId: 'prog-1',
      clientId: 'client-1',
    });

    await newHandler(prisma).execute({
      bookingId: 'book-1',
      changedBy: 'user-42',
      reason: 'client is here now',
    });

    expect((prisma as any).program.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'prog-1',
          enrolledCount: { lt: 10 },
        }),
        data: { enrolledCount: { increment: 1 } },
      }),
    );
    expect((prisma as any).programEnrollment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        programId: 'prog-1',
        clientId: 'client-1',
        bookingId: 'book-1',
      }),
    });
    expect((prisma as any).$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('skips re-enrollment when an enrollment already exists for this booking (idempotency)', async () => {
    const prisma = buildPrisma();
    withProgramStubs(prisma, { existingEnrollment: true });
    prisma.booking.findUnique = jest.fn().mockResolvedValue({
      ...mockBooking,
      status: BookingStatus.NO_SHOW,
      programId: 'prog-1',
      clientId: 'client-1',
    });

    await newHandler(prisma).execute({
      bookingId: 'book-1',
      changedBy: 'user-42',
      reason: 'idempotent restore',
    });

    expect((prisma as any).program.updateMany).not.toHaveBeenCalled();
    expect((prisma as any).programEnrollment.create).not.toHaveBeenCalled();
  });

  it('rejects the restore when the program is now full, rather than confirming a GROUP booking without a seat', async () => {
    const prisma = buildPrisma();
    withProgramStubs(prisma, { programFull: true });
    prisma.booking.findUnique = jest.fn().mockResolvedValue({
      ...mockBooking,
      status: BookingStatus.NO_SHOW,
      programId: 'prog-1',
      clientId: 'client-1',
    });

    await expect(
      newHandler(prisma).execute({
        bookingId: 'book-1',
        changedBy: 'user-42',
        reason: 'program filled up while client was away',
      }),
    ).rejects.toThrow(BadRequestException);

    expect((prisma as any).programEnrollment.create).not.toHaveBeenCalled();
    expect(prisma.bookingStatusLog.create).not.toHaveBeenCalled();
  });

  it('rejects the restore when the GROUP booking no longer has a program to own its seat', async () => {
    const prisma = buildPrisma();
    withProgramStubs(prisma, { programMissing: true });
    prisma.booking.findUnique = jest.fn().mockResolvedValue({
      ...mockBooking,
      status: BookingStatus.NO_SHOW,
      programId: 'prog-deleted',
      clientId: 'client-1',
    });

    await expect(
      newHandler(prisma).execute({
        bookingId: 'book-1',
        changedBy: 'user-42',
        reason: 'program deleted under us',
      }),
    ).rejects.toThrow(BadRequestException);

    expect((prisma as any).program.updateMany).not.toHaveBeenCalled();
    expect((prisma as any).programEnrollment.create).not.toHaveBeenCalled();
  });

  it('rejects the restore when the GROUP program was cancelled while the booking was no-show', async () => {
    const prisma = buildPrisma();
    withProgramStubs(prisma, { programCancelled: true });
    prisma.booking.findUnique = jest.fn().mockResolvedValue({
      ...mockBooking,
      status: BookingStatus.NO_SHOW,
      bookingType: BookingType.GROUP,
      programId: 'prog-1',
      clientId: 'client-1',
    });

    await expect(
      newHandler(prisma).execute({
        bookingId: 'book-1',
        changedBy: 'user-42',
        reason: 'program was cancelled',
      }),
    ).rejects.toThrow(BadRequestException);

    expect((prisma as any).programEnrollment.create).not.toHaveBeenCalled();
    expect(prisma.bookingStatusLog.create).not.toHaveBeenCalled();
  });

  it('does NOT touch program models when the booking has no programId', async () => {
    const prisma = buildPrisma();
    withProgramStubs(prisma);
    prisma.booking.findUnique = jest.fn().mockResolvedValue({
      ...mockBooking,
      status: BookingStatus.NO_SHOW,
      programId: null,
    });

    await newHandler(prisma).execute({
      bookingId: 'book-1',
      changedBy: 'user-42',
      reason: 'individual booking',
    });

    expect((prisma as any).programEnrollment.findUnique).not.toHaveBeenCalled();
    expect((prisma as any).program.updateMany).not.toHaveBeenCalled();
  });
});
