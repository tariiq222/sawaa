import type { ChatConversation } from '@prisma/client';

/** Public-safe projection. Never expose guest credential or contact fields. */
export function toChatConversationResponse(conversation: ChatConversation) {
  return {
    id: conversation.id,
    clientId: conversation.clientId,
    employeeId: conversation.employeeId,
    isAiChat: conversation.isAiChat,
    status: conversation.status,
    language: conversation.language,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
  };
}
