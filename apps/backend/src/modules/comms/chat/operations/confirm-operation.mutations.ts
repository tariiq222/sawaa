import { ChatOperationType, type ChatOperation, type Prisma } from '@prisma/client';
import { ACTIVE_BOOKING_STATUSES } from '../../../bookings/active-booking-statuses';
import type { ClientRescheduleBookingHandler } from '../../../bookings/client/client-reschedule-booking.handler';
import type { CreateBookingHandler } from '../../../bookings/create-booking/create-booking.handler';
import type {
  ChatBookingQuoteService,
  PreparedBookingPayload,
  PreparedReschedulePayload,
} from './chat-booking-quote.service';
import { OperationExecutionError } from './confirm-operation.errors';
import {
  buildBookingQuoteInput,
  buildCreateBookingInput,
} from './confirm-operation.mutation-inputs';
import {
  assertPayloadUnchanged,
  buildCreationRequestHash,
  creationIdempotencyKey,
  operationPayload,
  payloadString,
} from './confirm-operation.payload';
import { assertRecoveredCreation } from './confirm-operation.recovery';
import type { MutationResult } from './confirm-operation.types';

export interface OperationMutationDeps {
  quote: ChatBookingQuoteService;
  createBooking: CreateBookingHandler;
  rescheduleBooking: ClientRescheduleBookingHandler;
}

/**
 * Runs the confirmed mutation inside the caller-owned transaction. The caller
 * keeps transaction ownership; this module only dispatches by operation type
 * with the exact query order the handler used before extraction.
 */
export async function executeOperationMutation(
  deps: OperationMutationDeps,
  tx: Prisma.TransactionClient,
  operation: ChatOperation,
): Promise<MutationResult> {
  const payload = operationPayload(operation.payload);
  const clientId = operation.clientId!;

  if (operation.type === ChatOperationType.CREATE_BOOKING) {
    return executeCreateBooking(deps, tx, operation, payload, clientId);
  }
  if (operation.type === ChatOperationType.RESCHEDULE_BOOKING) {
    return executeReschedule(deps, tx, operation, payload, clientId);
  }
  if (operation.type === ChatOperationType.CANCEL_BOOKING) {
    // Chat confirmations do not display the current refund quote. Never invent
    // consent on the client's behalf; the appointment screen owns this flow.
    throw new OperationExecutionError(
      'CANCELLATION_CONSENT_REQUIRED',
      'Review cancellation terms on the appointment screen',
    );
  }
  throw new OperationExecutionError('UNSUPPORTED_OPERATION', 'Operation cannot be confirmed');
}

async function executeCreateBooking(
  deps: OperationMutationDeps,
  tx: Prisma.TransactionClient,
  operation: ChatOperation,
  payload: Record<string, Prisma.JsonValue>,
  clientId: string,
): Promise<MutationResult> {
  const idempotencyKey = creationIdempotencyKey(operation.id);
  const requestHash = buildCreationRequestHash(payload, clientId);
  const recovered = await tx.booking.findUnique({
    where: { creationIdempotencyKey: idempotencyKey },
  });
  if (recovered) {
    await assertRecoveredCreation(tx, requestHash, recovered);
    return { bookingId: recovered.id, outcome: 'BOOKING_CREATED' };
  }
  if (operation.requiredConfirmations === 1) {
    const futureBooking = await tx.booking.findFirst({
      where: {
        clientId,
        status: { in: [...ACTIVE_BOOKING_STATUSES] },
        isHistoricalImport: false,
        scheduledAt: { gt: new Date() },
      },
      select: { id: true },
    });
    if (futureBooking) {
      throw new OperationExecutionError(
        'EXISTING_BOOKING_CHANGED',
        'A future appointment now requires an additional-booking acknowledgement',
      );
    }
  }
  const fresh = await deps.quote.quoteBooking(buildBookingQuoteInput(payload, clientId, tx));
  assertPayloadUnchanged(operation.payload, fresh.payload);
  const trusted = fresh.payload as PreparedBookingPayload;
  const booking = await deps.createBooking.execute(
    buildCreateBookingInput(trusted, clientId, idempotencyKey, requestHash, tx),
  );
  return { bookingId: booking.id, outcome: 'BOOKING_CREATED' };
}

async function executeReschedule(
  deps: OperationMutationDeps,
  tx: Prisma.TransactionClient,
  operation: ChatOperation,
  payload: Record<string, Prisma.JsonValue>,
  clientId: string,
): Promise<MutationResult> {
  const bookingId = payloadString(payload, 'bookingId');
  const newScheduledAt = payloadString(payload, 'newScheduledAt');
  const recovered = await tx.bookingStatusLog.findUnique({
    where: { sourceActionId: operation.id },
    select: { id: true },
  });
  if (!recovered) {
    const fresh = await deps.quote.quoteReschedule({
      clientId, bookingId, newScheduledAt, transaction: tx,
    });
    assertPayloadUnchanged(operation.payload, fresh.payload as PreparedReschedulePayload);
  }
  const result = await deps.rescheduleBooking.execute({
    bookingId,
    clientId,
    newScheduledAt,
    sourceActionId: operation.id,
    transaction: tx,
  });
  return {
    bookingId: result.booking.id,
    outcome: 'BOOKING_RESCHEDULED',
    syncPending: Boolean(result.booking.zoomMeetingId),
  };
}
