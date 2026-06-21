import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ProgramStatus } from '@prisma/client';
import { ScheduleProgramHandler } from './schedule-program.handler';
import {
  PrismaService,
  RlsTransactionService,
} from '../../../infrastructure/database';

describe('ScheduleProgramHandler', () => {
  let handler: ScheduleProgramHandler;
  let tx: any;
  let rlsTransaction: any;

  const futureIso = '2099-08-01T16:00:00.000Z';

  beforeEach(async () => {
    tx = {
      program: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'prog-1',
          status: ProgramStatus.MIN_REACHED,
          hoursPerDay: 4,
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      booking: {
        updateMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
    };
    rlsTransaction = {
      withTransaction: jest.fn(async (fn: (t: unknown) => Promise<unknown>) => fn(tx)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScheduleProgramHandler,
        { provide: PrismaService, useValue: {} },
        { provide: RlsTransactionService, useValue: rlsTransaction },
      ],
    }).compile();

    handler = module.get(ScheduleProgramHandler);
  });

  it('rejects a past startDate', async () => {
    await expect(
      handler.execute('prog-1', { startDate: '2000-01-01T00:00:00.000Z' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws NotFound when the program does not exist', async () => {
    tx.program.findUnique.mockResolvedValue(null);
    await expect(
      handler.execute('prog-1', { startDate: futureIso }),
    ).rejects.toThrow(NotFoundException);
  });

  it('sets startDate, transitions to SCHEDULED and back-fills booking dates with endsAt > scheduledAt', async () => {
    const result = await handler.execute('prog-1', { startDate: futureIso });

    expect(result.status).toBe(ProgramStatus.SCHEDULED);
    expect(tx.program.update).toHaveBeenCalledWith({
      where: { id: 'prog-1' },
      data: { status: ProgramStatus.SCHEDULED, startDate: new Date(futureIso) },
    });

    // Regression: the booking back-fill previously set endsAt == startDate,
    // violating the Booking_endsAt_after_scheduledAt_chk CHECK constraint and
    // 500-ing every schedule against a real DB.
    const updateArg = tx.booking.updateMany.mock.calls[0][0];
    expect(updateArg.where).toEqual({ programId: 'prog-1' });
    expect(updateArg.data.scheduledAt).toEqual(new Date(futureIso));
    expect(updateArg.data.endsAt.getTime()).toBeGreaterThan(
      updateArg.data.scheduledAt.getTime(),
    );
  });
});
