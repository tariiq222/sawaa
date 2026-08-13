import { Injectable } from '@nestjs/common';
import { EventBusService, type DomainEventEnvelope } from '../../../../infrastructure/events';
import type { ChatOperationsResumeRequestedPayload } from './events/chat-operations-resume-requested.event';
import { ResumeChatOperationsHandler } from './resume-chat-operations.handler';

export const CHAT_OPERATIONS_RESUME_CONSUMER_ID = 'comms.chat-operations-resume.v1';

@Injectable()
export class OnChatOperationsResumeRequestedHandler {
  constructor(
    private readonly eventBus: EventBusService,
    private readonly resume: ResumeChatOperationsHandler,
  ) {}

  register(): void {
    this.eventBus.subscribe<ChatOperationsResumeRequestedPayload>(
      'comms.chat.operations.resume_requested',
      CHAT_OPERATIONS_RESUME_CONSUMER_ID,
      (event) => this.handle(event),
    );
  }

  async handle(event: DomainEventEnvelope<ChatOperationsResumeRequestedPayload>): Promise<void> {
    await this.resume.execute(event.payload);
  }
}
