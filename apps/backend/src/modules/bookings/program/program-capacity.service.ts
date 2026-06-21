import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';

/**
 * ProgramCapacityService
 * ======================
 * Keeps `Program.enrolledCount` in sync when a participant leaves (cancellation,
 * expiry, no-show).
 *
 * The program model exposes a guarded `decrementEnrollment` only — the
 * increment happens transactionally inside the shared enrollment handler so a
 * race can never push enrolledCount past maxParticipants.
 */
@Injectable()
export class ProgramCapacityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rlsTransaction: RlsTransactionService,
  ) {}

  /**
   * Decrement the program's enrolled count after a participant has left,
   * floored at 0 via a guarded conditional update. Called inside the booking
   * lifecycle transaction (cancel/expire/no-show).
   *
   * @param tx        - The Prisma transaction client.
   * @param programId - The ID of the program to decrement.
   */
  async decrementEnrollment(
    tx: Prisma.TransactionClient,
    programId: string,
  ): Promise<void> {
    await tx.program.updateMany({
      where: { id: programId, enrolledCount: { gt: 0 } },
      data: { enrolledCount: { decrement: 1 } },
    });
  }

  /**
   * Standalone version for handlers that do not run inside a transaction.
   * Opens its own transaction internally.
   */
  async decrementEnrollmentStandalone(programId: string): Promise<void> {
    await this.rlsTransaction.withTransaction(async (tx) => {
      await this.decrementEnrollment(tx, programId);
    });
  }
}
