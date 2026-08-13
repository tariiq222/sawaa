/**
 * Safe read projections for OutboxEvent rows exposed through the ops API.
 *
 * The raw row carries `payload` (full domain event data, may include PII).
 * Admin read endpoints must go through these views so the payload column is
 * never selected, serialized, or returned. `failureReason` is sanitized and
 * truncated because it may contain raw provider error text.
 */

/** Mirrors the cron's truncation length when writing failureReason. */
export const MAX_FAILURE_REASON_LENGTH = 500;

/** Strip control characters and collapse whitespace, then truncate. */
export function sanitizeFailureReason(reason: string | null): string | null {
  if (!reason) return null;
  const cleaned = reason
    // Removing C0 control chars is the whole point of this sanitizer.
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.slice(0, MAX_FAILURE_REASON_LENGTH) || null;
}

/** Columns exposed for a terminal FAILED outbox event. No payload. */
export interface OutboxFailedEventView {
  id: string;
  eventType: string;
  attemptCount: number;
  createdAt: Date;
  failedAt: Date | null;
  failureReason: string | null;
}

/** Result of an explicit retry: the row is back to PENDING. */
export interface OutboxRetryEventView extends OutboxFailedEventView {
  status: 'PENDING' | 'PENDING_V2';
}

export type OutboxEventRowShape = {
  id: string;
  eventType: string;
  attemptCount: number;
  createdAt: Date;
  failedAt: Date | null;
  failureReason: string | null;
};

export function toFailedEventView(row: OutboxEventRowShape): OutboxFailedEventView {
  return {
    id: row.id,
    eventType: row.eventType,
    attemptCount: row.attemptCount,
    createdAt: row.createdAt,
    failedAt: row.failedAt,
    failureReason: sanitizeFailureReason(row.failureReason),
  };
}
