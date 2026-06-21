import { BaseEvent } from '../../../common/events';
import { ProgramStatus } from '@prisma/client';

export interface ProgramMinReachedPayload {
  programId: string;
  programRef: number;
  programNameAr: string;
  programNameEn: string | null;
  enrolledCount: number;
  minParticipants: number;
  reachedAt: Date;
}

/**
 * Emitted when a program's enrollment count crosses the configured minimum
 * (OPEN → MIN_REACHED). Notifications subscribes to alert the manager.
 */
export class ProgramMinReachedEvent extends BaseEvent<ProgramMinReachedPayload> {
  readonly eventName = 'bookings.program.min_reached';

  constructor(payload: ProgramMinReachedPayload) {
    super({ source: 'bookings', version: 1, payload });
  }
}
