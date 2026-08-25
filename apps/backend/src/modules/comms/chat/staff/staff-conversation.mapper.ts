import type { Prisma } from '@prisma/client';
import { parseHandoffSummary, type HandoffSummary } from '../assistant/administrative-tools.service';

export const STAFF_CONVERSATION_SELECT = {
  id: true,
  clientId: true,
  isAiChat: true,
  status: true,
  guestName: true,
  guestPhone: true,
  language: true,
  assignedStaffUserId: true,
  handoffRequestedAt: true,
  staffClaimedAt: true,
  closedAt: true,
  staffUnreadCount: true,
  clientUnreadCount: true,
  lastMessageAt: true,
  createdAt: true,
  updatedAt: true,
  customerContext: true,
} as const satisfies Prisma.ChatConversationSelect;

export const STAFF_MESSAGE_SELECT = {
  id: true,
  conversationId: true,
  senderType: true,
  body: true,
  kind: true,
  clientMessageId: true,
  createdAt: true,
} as const satisfies Prisma.CommsChatMessageSelect;

export type StaffMessageProjection = Prisma.CommsChatMessageGetPayload<{
  select: typeof STAFF_MESSAGE_SELECT;
}>;

type StaffConversationRow = Prisma.ChatConversationGetPayload<{
  select: typeof STAFF_CONVERSATION_SELECT;
}>;

export type StaffConversationResponse = Omit<StaffConversationRow, 'customerContext'> & { handoffSummary: HandoffSummary | null };

export function toStaffConversationResponse(value: StaffConversationRow): StaffConversationResponse {
  return {
    id: value.id,
    clientId: value.clientId,
    isAiChat: value.isAiChat,
    status: value.status,
    guestName: value.guestName,
    guestPhone: value.guestPhone,
    language: value.language,
    assignedStaffUserId: value.assignedStaffUserId,
    handoffRequestedAt: value.handoffRequestedAt,
    staffClaimedAt: value.staffClaimedAt,
    closedAt: value.closedAt,
    staffUnreadCount: value.staffUnreadCount,
    clientUnreadCount: value.clientUnreadCount,
    lastMessageAt: value.lastMessageAt,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    handoffSummary: parseHandoffSummary(
      value.customerContext && typeof value.customerContext === 'object' && !Array.isArray(value.customerContext)
        ? value.customerContext.handoffSummary
        : undefined,
    ),
  };
}
