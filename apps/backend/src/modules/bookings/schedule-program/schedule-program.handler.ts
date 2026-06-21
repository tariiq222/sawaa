import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import {
  PrismaService,
  RlsTransactionService,
} from '../../../infrastructure/database';
import { assertProgramTransition } from '../program/program-state-machine';
import { ScheduleProgramDto } from '../enroll-in-program/enroll-in-program.dto';

/**
 * Sets the program's startDate and transitions it to SCHEDULED. The
 * placeholder scheduledAt on each enrollment booking is rewritten to the
 * real startDate inside the same transaction so clients see a coherent
 * snapshot after schedule.
 */
@Injectable()
export class ScheduleProgramHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rlsTransaction: RlsTransactionService,
  ) {}

  async execute(programId: string, dto: ScheduleProgramDto) {
    const startDate = new Date(dto.startDate);
    if (Number.isNaN(startDate.getTime())) {
      throw new BadRequestException('Invalid startDate');
    }
    if (startDate.getTime() <= Date.now()) {
      throw new BadRequestException('startDate must be in the future');
    }

    return this.rlsTransaction.withTransaction(async (tx) => {
      const program = await tx.program.findUnique({
        where: { id: programId },
      });
      if (!program) throw new NotFoundException('Program not found');

      const nextStatus = assertProgramTransition(program.status, 'SCHEDULE');

      await tx.program.update({
        where: { id: programId },
        data: { status: nextStatus, startDate },
      });

      // Rewrite the placeholder scheduledAt on every enrollment booking so
      // the public booking detail reflects the real appointment time.
      const placeholderEnd = new Date(startDate.getTime());
      await tx.booking.updateMany({
        where: { programId },
        data: { scheduledAt: startDate, endsAt: placeholderEnd },
      });

      return { id: programId, status: nextStatus, startDate };
    });
  }
}
