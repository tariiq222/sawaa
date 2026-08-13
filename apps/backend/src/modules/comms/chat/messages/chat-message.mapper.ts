import type { ChatMessageKind, MessageSenderType } from '@prisma/client';

export interface ChatMessageResponse {
  id: string;
  conversationId: string;
  senderType: MessageSenderType;
  body: string;
  kind: ChatMessageKind;
  clientMessageId: string | null;
  createdAt: Date;
}

export function toChatMessageResponse<T extends ChatMessageResponse>(message: T): ChatMessageResponse {
  return {
    id: message.id,
    conversationId: message.conversationId,
    senderType: message.senderType,
    body: message.body,
    kind: message.kind,
    clientMessageId: message.clientMessageId,
    createdAt: message.createdAt,
  };
}
