import type { ChatMessageKind, CommsChatMessage, MessageSenderType } from '@prisma/client';

export interface ChatMessageResponse {
  id: string;
  conversationId: string;
  senderType: MessageSenderType;
  senderId: string | null;
  body: string;
  kind: ChatMessageKind;
  clientMessageId: string | null;
  createdAt: Date;
}

export function toChatMessageResponse(message: CommsChatMessage): ChatMessageResponse {
  return {
    id: message.id,
    conversationId: message.conversationId,
    senderType: message.senderType,
    senderId: message.senderId,
    body: message.body,
    kind: message.kind,
    clientMessageId: message.clientMessageId,
    createdAt: message.createdAt,
  };
}
