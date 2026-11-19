import type { Prisma } from '@prisma/client';
import type { PreparedBookingPayload } from './chat-booking-quote.service';
import {
  payloadDeliveryType,
  payloadOptionalString,
  payloadString,
} from './confirm-operation.payload';

/** Revalidation input for the immutable chat quote. */
export function buildBookingQuoteInput(
  payload: Record<string, Prisma.JsonValue>,
  clientId: string,
  tx: Prisma.TransactionClient,
) {
  return {
    clientId,
    branchId: payloadString(payload, 'branchId'),
    employeeId: payloadString(payload, 'employeeId'),
    serviceId: payloadString(payload, 'serviceId'),
    scheduledAt: payloadString(payload, 'scheduledAt'),
    durationOptionId: payloadOptionalString(payload, 'durationOptionId') ?? undefined,
    deliveryType: payloadDeliveryType(payload, 'deliveryType'),
    transaction: tx,
  };
}

/** Creation command handed to the booking handler after a quote revalidation. */
export function buildCreateBookingInput(
  trusted: PreparedBookingPayload,
  clientId: string,
  creationIdempotencyKey: string,
  creationRequestHash: string,
  tx: Prisma.TransactionClient,
) {
  return {
    branchId: trusted.branchId,
    clientId,
    employeeId: trusted.employeeId,
    serviceId: trusted.serviceId,
    scheduledAt: new Date(trusted.scheduledAt),
    ...(trusted.durationOptionId ? { durationOptionId: trusted.durationOptionId } : {}),
    bookingType: trusted.bookingType,
    deliveryType: trusted.deliveryType,
    currency: trusted.currency,
    source: 'AI_CHAT' as const,
    creationIdempotencyKey,
    creationRequestHash,
    transaction: tx,
  };
}
