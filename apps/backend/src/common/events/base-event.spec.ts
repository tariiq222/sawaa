import { BaseEvent } from './base-event';
import { RequestContextStorage } from '../http/request-context';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

class TestEvent extends BaseEvent<{ bookingId: string }> {
  readonly eventName = 'test.happened';

  constructor(payload: { bookingId: string }, correlationId?: string) {
    super({ source: 'test', version: 1, payload, correlationId });
  }
}

describe('BaseEvent', () => {
  it('auto-populates eventId as a UUID and occurredAt as now', () => {
    const before = Date.now();
    const event = new TestEvent({ bookingId: 'b-1' });
    const after = Date.now();

    expect(event.eventId).toMatch(UUID_RE);
    expect(event.occurredAt).toBeInstanceOf(Date);
    expect(event.occurredAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(event.occurredAt.getTime()).toBeLessThanOrEqual(after);
  });

  it('generates a unique eventId per instance', () => {
    const a = new TestEvent({ bookingId: 'b-1' });
    const b = new TestEvent({ bookingId: 'b-1' });
    expect(a.eventId).not.toBe(b.eventId);
  });

  describe('correlationId resolution chain', () => {
    it('an explicit correlationId wins over the request context', () => {
      RequestContextStorage.run({ requestId: 'req-from-ctx' }, () => {
        const event = new TestEvent({ bookingId: 'b-1' }, 'explicit-corr');
        expect(event.correlationId).toBe('explicit-corr');
      });
    });

    it('falls back to the active request context requestId', () => {
      RequestContextStorage.run({ requestId: 'req-123' }, () => {
        const event = new TestEvent({ bookingId: 'b-1' });
        expect(event.correlationId).toBe('req-123');
      });
    });

    it('generates a random UUID when there is no request context (cron/queue path)', () => {
      expect(RequestContextStorage.get()).toBeUndefined();
      const event = new TestEvent({ bookingId: 'b-1' });
      expect(event.correlationId).toMatch(UUID_RE);
      expect(event.correlationId).not.toBe(event.eventId);
    });
  });

  describe('toEnvelope', () => {
    it('serialises every field the EventBus transport expects', () => {
      const event = new TestEvent({ bookingId: 'b-9' }, 'corr-9');
      expect(event.toEnvelope()).toEqual({
        eventId: event.eventId,
        correlationId: 'corr-9',
        source: 'test',
        version: 1,
        occurredAt: event.occurredAt,
        payload: { bookingId: 'b-9' },
      });
    });

    it('does not leak eventName into the envelope', () => {
      const envelope = new TestEvent({ bookingId: 'b-1' }).toEnvelope();
      expect(envelope).not.toHaveProperty('eventName');
    });
  });
});
