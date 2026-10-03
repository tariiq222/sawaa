import { Injectable, OnModuleInit } from '@nestjs/common';
import { EventBusService, type DomainEventEnvelope } from '../../../infrastructure/events';
import type { ProgramCancellationResult } from './cancel-program.handler';

/** Acknowledges the result event; participant events exclusively own side effects. */
@Injectable()
export class ProgramCancelledResultHandler implements OnModuleInit {
  constructor(private readonly eventBus: EventBusService) {}

  onModuleInit(): void {
    this.eventBus.subscribe<ProgramCancellationResult>(
      'bookings.program.cancelled',
      'bookings.program-cancelled-result.v1',
      async (envelope: DomainEventEnvelope<ProgramCancellationResult>) => {
        if (envelope.version !== 1 || !envelope.payload.id || envelope.payload.status !== 'CANCELLED') {
          throw new Error('Unsupported program cancellation result');
        }
        // The immutable outbox payload is the retry result. Acknowledge delivery
        // without repeating any booking, financial or notification side effects.
      },
    );
  }
}
