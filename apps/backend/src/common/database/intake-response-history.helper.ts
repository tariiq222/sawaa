import { Prisma } from '@prisma/client';

/**
 * Canonicalize JSON for equality checks without changing the meaning of
 * arrays. Object key order is incidental; array order is part of an answer.
 */
export function canonicalizeIntakeJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalizeIntakeJson);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
        .map(([key, child]) => [key, canonicalizeIntakeJson(child)]),
    );
  }
  return value;
}

export function areIntakeAnswersEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(canonicalizeIntakeJson(left)) === JSON.stringify(canonicalizeIntakeJson(right));
}

export interface IntakeResponseSnapshot {
  id: string;
  bookingId: string;
  formId: string;
  clientId: string | null;
  answers: Prisma.JsonValue;
}

export function toIntakeRevisionData(
  response: IntakeResponseSnapshot,
  reason: 'UPDATE' | 'AUTHORIZED_DELETE',
): Prisma.IntakeResponseRevisionCreateManyInput {
  return {
    sourceResponseId: response.id,
    bookingId: response.bookingId,
    formId: response.formId,
    clientId: response.clientId,
    answers: response.answers as Prisma.InputJsonValue,
    reason,
  };
}
