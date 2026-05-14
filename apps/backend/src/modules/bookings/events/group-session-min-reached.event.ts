import { randomUUID } from 'crypto';
import type { DomainEventEnvelope } from '../../../infrastructure/events';

export interface GroupSessionMinReachedPayload {
  serviceId: string;
  groupSessionKey: string; // employeeId:serviceId:scheduledAt ISO string — identifies the session slot
  bookingIds: string[];    // all bookings in PENDING_GROUP_FILL for this slot
}

export class GroupSessionMinReachedEvent {
  readonly eventName = 'group_session.min_reached';

  constructor(
    public readonly payload: GroupSessionMinReachedPayload,
  ) {}

  toEnvelope(): DomainEventEnvelope<GroupSessionMinReachedPayload> {
    return {
      eventId: randomUUID(),
      source: 'bookings',
      version: 1,
      occurredAt: new Date(),
      payload: this.payload,
    };
  }
}
