import {
  BookingSource,
  ChatMessageKind,
  ChatOperationStatus,
  ChatOperationType,
  ConversationStatus,
  MessageSenderType,
  Prisma,
} from '@prisma/client';

describe('unified chat persistence contract', () => {
  it('accepts a guest action-card operation with an idempotent AI booking source', () => {
    const conversation =
      Prisma.validator<Prisma.ChatConversationUncheckedCreateInput>()({
        clientId: null,
        guestTokenHash: 'guest-token-hash',
        guestName: 'ضيف سواء',
        guestPhone: '+966500000000',
        language: 'ar',
        status: ConversationStatus.AI_ACTIVE,
        staffUnreadCount: 0,
        clientUnreadCount: 0,
      });

    const message =
      Prisma.validator<Prisma.CommsChatMessageUncheckedCreateInput>()({
        conversationId: 'conversation-1',
        senderType: MessageSenderType.AI,
        body: 'هل تريد تأكيد الموعد؟',
        kind: ChatMessageKind.ACTION_CARD,
        metadata: { action: 'confirm_booking' },
        clientMessageId: 'client-message-1',
        responseForMessageId: 'visitor-message-1',
        model: 'test-model',
        tokensUsed: 12,
        latencyMs: 180,
      });

    const operation =
      Prisma.validator<Prisma.ChatOperationUncheckedCreateInput>()({
        conversationId: 'conversation-1',
        clientId: null,
        type: ChatOperationType.CREATE_BOOKING,
        status: ChatOperationStatus.AWAITING_EXISTING_BOOKING_ACK,
        payload: { source: BookingSource.AI_CHAT },
        summary: { serviceName: 'استشارة أسرية' },
        idempotencyKey: 'chat-operation-1',
        requiredConfirmations: 2,
        confirmationCount: 0,
        version: 0,
        expiresAt: new Date('2026-08-13T12:00:00.000Z'),
      });

    expect({ conversation, message, operation }).toMatchObject({
      conversation: {
        clientId: null,
        status: ConversationStatus.AI_ACTIVE,
      },
      message: {
        kind: ChatMessageKind.ACTION_CARD,
        responseForMessageId: 'visitor-message-1',
      },
      operation: {
        status: ChatOperationStatus.AWAITING_EXISTING_BOOKING_ACK,
        payload: { source: BookingSource.AI_CHAT },
        idempotencyKey: 'chat-operation-1',
      },
    });
  });
});
