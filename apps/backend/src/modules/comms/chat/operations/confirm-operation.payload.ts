import { DeliveryType, type Prisma } from '@prisma/client';
import { isDeepStrictEqual } from 'node:util';
import { bookingCreationRequestHash } from '../../../bookings/create-booking/creation-request-hash';
import { OperationExecutionError } from './confirm-operation.errors';

export function operationPayload(value: Prisma.JsonValue): Record<string, Prisma.JsonValue> {
  if (!value || Array.isArray(value) || typeof value !== 'object') {
    throw new OperationExecutionError('INVALID_PAYLOAD', 'Operation payload is invalid');
  }
  return value as Record<string, Prisma.JsonValue>;
}

export function payloadString(payload: Record<string, Prisma.JsonValue>, key: string): string {
  const value = payload[key];
  if (typeof value !== 'string' || value.length === 0) {
    throw new OperationExecutionError('INVALID_PAYLOAD', `Operation ${key} is invalid`);
  }
  return value;
}

export function payloadOptionalString(payload: Record<string, Prisma.JsonValue>, key: string): string | null {
  const value = payload[key];
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string' || value.length === 0) {
    throw new OperationExecutionError('INVALID_PAYLOAD', `Operation ${key} is invalid`);
  }
  return value;
}

export function payloadNumber(payload: Record<string, Prisma.JsonValue>, key: string): number {
  const value = payload[key];
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new OperationExecutionError('INVALID_PAYLOAD', `Operation ${key} is invalid`);
  }
  return value;
}

export function payloadDeliveryType(payload: Record<string, Prisma.JsonValue>, key: string): DeliveryType {
  const value = payloadString(payload, key);
  if (!Object.values(DeliveryType).includes(value as DeliveryType)) {
    throw new OperationExecutionError('INVALID_PAYLOAD', 'Operation delivery type is invalid');
  }
  return value as DeliveryType;
}

export function assertPayloadUnchanged(stored: Prisma.JsonValue, fresh: object): void {
  if (!isDeepStrictEqual(stored, fresh)) {
    throw new OperationExecutionError('QUOTE_CHANGED', 'Prepared appointment details changed');
  }
}

/** A chat operation owns exactly one durable creation key. */
export function creationIdempotencyKey(operationId: string): string {
  return `chat-operation:${operationId}`;
}

export function buildCreationRequestHash(
  payload: Record<string, Prisma.JsonValue>,
  clientId: string,
): string {
  return bookingCreationRequestHash({
    branchId: payloadString(payload, 'branchId'),
    clientId,
    employeeId: payloadString(payload, 'employeeId'),
    serviceId: payloadString(payload, 'serviceId'),
    scheduledAt: payloadString(payload, 'scheduledAt'),
    endsAt: payloadString(payload, 'endsAt'),
    durationMins: payloadNumber(payload, 'durationMins'),
    durationOptionId: payloadOptionalString(payload, 'durationOptionId'),
    bookingType: payloadString(payload, 'bookingType'),
    deliveryType: payloadDeliveryType(payload, 'deliveryType'),
    price: payloadNumber(payload, 'price'),
    currency: payloadString(payload, 'currency'),
    // Prepared chat bookings intentionally have no mutable checkout fields.
    // Include their persisted defaults in the canonical command so legacy
    // null-hash recovery cannot bless a different durable shape.
    expiresAt: null,
    payAtClinic: false,
    couponCode: null,
    notes: null,
    source: 'AI_CHAT',
  });
}

export interface PersistedCreationBooking {
  id: string;
  clientId: string;
  branchId: string;
  employeeId: string;
  serviceId: string | null;
  scheduledAt: Date;
  endsAt: Date;
  durationMins: number;
  durationOptionId: string | null;
  bookingType: string;
  deliveryType: string;
  price: Prisma.Decimal;
  currency: string;
  expiresAt: Date | null;
  payAtClinic: boolean;
  couponCode: string | null;
  notes: string | null;
  source: string;
  creationRequestHash: string | null;
}

export function persistedCreationRequestHash(booking: PersistedCreationBooking): string {
  return bookingCreationRequestHash({
    branchId: booking.branchId,
    clientId: booking.clientId,
    employeeId: booking.employeeId,
    serviceId: booking.serviceId ?? '',
    scheduledAt: booking.scheduledAt.toISOString(),
    endsAt: booking.endsAt.toISOString(),
    durationMins: booking.durationMins,
    durationOptionId: booking.durationOptionId,
    bookingType: booking.bookingType,
    deliveryType: booking.deliveryType as never,
    price: Number(booking.price),
    currency: booking.currency,
    expiresAt: booking.expiresAt?.toISOString() ?? null,
    payAtClinic: booking.payAtClinic,
    couponCode: booking.couponCode,
    notes: booking.notes,
    source: booking.source,
  });
}
