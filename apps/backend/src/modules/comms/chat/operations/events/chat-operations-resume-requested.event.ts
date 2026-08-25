import { BaseEvent } from '../../../../../common/events';
import { stableEventId } from '../../../../../common/events/stable-event-id';

export interface ChatOperationsResumeRequestedPayload {
  conversationId: string;
  clientId: string;
}

export class ChatOperationsResumeRequestedEvent extends BaseEvent<ChatOperationsResumeRequestedPayload> {
  readonly eventName = 'comms.chat.operations.resume_requested';

  constructor(payload: ChatOperationsResumeRequestedPayload) {
    super({
      source: 'comms',
      version: 1,
      payload,
      eventId: stableEventId(
        `chat:${payload.conversationId}:client:${payload.clientId}:resume-operations`,
      ),
    });
  }
}
