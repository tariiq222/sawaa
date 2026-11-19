import type { Prisma } from '@prisma/client';
import { OperationExecutionError } from './confirm-operation.errors';
import {
  type PersistedCreationBooking,
  persistedCreationRequestHash,
} from './confirm-operation.payload';

/**
 * A crashed create is recoverable only when the durable row derives the same
 * request hash from its persisted columns. Legacy rows with a null hash are
 * backfilled, and a lost backfill race is accepted only when the winner wrote
 * the same hash.
 */
export async function assertRecoveredCreation(
  tx: Prisma.TransactionClient,
  creationRequestHash: string,
  booking: PersistedCreationBooking,
): Promise<void> {
  const persistedHash = persistedCreationRequestHash(booking);
  if (persistedHash !== creationRequestHash) {
    throw new OperationExecutionError(
      'IDEMPOTENCY_CONFLICT',
      'Durable creation key belongs to a different booking',
    );
  }
  if (booking.creationRequestHash === creationRequestHash) return;
  if (booking.creationRequestHash !== null) {
    throw new OperationExecutionError(
      'IDEMPOTENCY_CONFLICT',
      'Durable creation key belongs to a different booking',
    );
  }
  const backfilled = await tx.booking.updateMany({
    where: { id: booking.id, creationRequestHash: null },
    data: { creationRequestHash },
  });
  if (backfilled.count !== 1) {
    const raced = await tx.booking.findUnique({
      where: { id: booking.id },
      select: { creationRequestHash: true },
    });
    if (raced?.creationRequestHash !== creationRequestHash) {
      throw new OperationExecutionError(
        'IDEMPOTENCY_CONFLICT',
        'Durable creation key hash backfill raced with another request',
      );
    }
  }
}
