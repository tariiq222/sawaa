import { randomUUID } from 'crypto';
import { RequestContextStorage } from '../http/request-context';

/**
 * Base class for all domain events in Deqah.
 *
 * Every Bounded Context extends this to define its own events.
 * The constructor auto-populates eventId, occurredAt, and pulls
 * correlationId from the active RequestContext when available.
 *
 * @example
 * class BookingConfirmedEvent extends BaseEvent<{ bookingId: string }> {
 *   readonly eventName = 'booking.confirmed';
 *   constructor(payload: { bookingId: string }) {
 *     super({ source: 'bookings', version: 1, payload });
 *   }
 * }
 */
export abstract class BaseEvent<TPayload = unknown> {
  abstract readonly eventName: string;

  readonly eventId: string;
  readonly correlationId: string;
  readonly source: string;
  readonly version: number;
  readonly occurredAt: Date;
  readonly payload: TPayload;

  protected constructor(opts: {
    source: string;
    version: number;
    payload: TPayload;
    correlationId?: string;
  }) {
    const ctx = RequestContextStorage.get();
    this.eventId = randomUUID();
    this.correlationId = opts.correlationId ?? ctx?.requestId ?? randomUUID();
    this.source = opts.source;
    this.version = opts.version;
    this.occurredAt = new Date();
    this.payload = opts.payload;
  }

  /** Serialises the event to the transport envelope shape expected by EventBusService. */
  toEnvelope(): {
    eventId: string;
    correlationId: string;
    source: string;
    version: number;
    occurredAt: Date;
    payload: TPayload;
  } {
    return {
      eventId: this.eventId,
      correlationId: this.correlationId,
      source: this.source,
      version: this.version,
      occurredAt: this.occurredAt,
      payload: this.payload,
    };
  }
}
