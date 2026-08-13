import {
  ChatMessageKind,
  ChatOperationStatus,
  ChatOperationType,
  MessageSenderType,
} from '@prisma/client';
import { toChatMessageResponse } from './chat-message.mapper';

describe('toChatMessageResponse', () => {
  it('maps only public message fields and never exposes AI metadata or accounting fields', () => {
    const response = toChatMessageResponse({
      id: 'message-1',
      sequence: 1n,
      conversationId: 'conversation-1',
      senderType: MessageSenderType.AI,
      senderId: 'staff-internal-id',
      body: 'كيف يمكنني مساعدتك؟',
      kind: 'TEXT',
      clientMessageId: 'client-message-1',
      createdAt: new Date('2026-08-13T10:00:00.000Z'),
      metadata: { providerTrace: 'private' },
      model: 'private-model',
      tokensUsed: 123,
      latencyMs: 50,
      responseForMessageId: 'message-0',
      isRead: false,
      readAt: null,
    });

    expect(response).toEqual({
      id: 'message-1',
      conversationId: 'conversation-1',
      senderType: MessageSenderType.AI,
      body: 'كيف يمكنني مساعدتك؟',
      kind: 'TEXT',
      clientMessageId: 'client-message-1',
      createdAt: new Date('2026-08-13T10:00:00.000Z'),
    });
    expect(response).not.toHaveProperty('senderId');
  });

  it('exposes only a validated public operation card projection', () => {
    const response = toChatMessageResponse({
      id: 'message-2',
      conversationId: 'conversation-1',
      senderType: MessageSenderType.AI,
      body: 'راجع طلب الموعد ثم أكده من الزر.',
      kind: ChatMessageKind.ACTION_CARD,
      clientMessageId: null,
      createdAt: new Date('2026-08-13T10:01:00.000Z'),
      metadata: {
        action: 'CHAT_OPERATION',
        privateTrace: 'must-not-leak',
        operation: {
          id: 'operation-1',
          type: ChatOperationType.CREATE_BOOKING,
          status: ChatOperationStatus.AWAITING_CONFIRMATION,
          version: 0,
          requiredConfirmations: 1,
          confirmationCount: 0,
          expiresAt: '2026-08-13T10:16:00.000Z',
          bookingId: null,
          errorCode: null,
          summary: {
            action: 'CREATE_BOOKING',
            serviceName: 'جلسة إرشاد أسري',
            scheduledAt: '2026-08-20T09:00:00.000Z',
          },
        },
      },
    });

    expect(response.metadata).toEqual({
      action: 'CHAT_OPERATION',
      operation: expect.objectContaining({
        id: 'operation-1',
        status: ChatOperationStatus.AWAITING_CONFIRMATION,
      }),
    });
    expect(JSON.stringify(response.metadata)).not.toContain('must-not-leak');
  });

  it('reconstructs public operation-result metadata and rejects forged card data', () => {
    const result = toChatMessageResponse({
      id: 'message-3',
      conversationId: 'conversation-1',
      senderType: MessageSenderType.SYSTEM,
      body: 'تم حجز الموعد بنجاح.',
      kind: ChatMessageKind.OPERATION_RESULT,
      clientMessageId: null,
      createdAt: new Date('2026-08-13T10:02:00.000Z'),
      metadata: {
        operationId: 'operation-1',
        type: ChatOperationType.CREATE_BOOKING,
        status: ChatOperationStatus.SUCCEEDED,
        bookingId: 'booking-1',
        outcome: 'BOOKING_CREATED',
        providerTrace: 'must-not-leak',
      },
    });
    const forgedCard = toChatMessageResponse({
      id: 'message-4',
      conversationId: 'conversation-1',
      senderType: MessageSenderType.AI,
      body: 'بطاقة غير صالحة',
      kind: ChatMessageKind.ACTION_CARD,
      clientMessageId: null,
      createdAt: new Date('2026-08-13T10:03:00.000Z'),
      metadata: {
        action: 'CHAT_OPERATION',
        operation: {
          id: 'operation-1',
          type: ChatOperationType.CREATE_BOOKING,
          status: ChatOperationStatus.AWAITING_CONFIRMATION,
          version: 0,
          requiredConfirmations: 1,
          confirmationCount: 0,
          expiresAt: '2026-08-13T10:18:00.000Z',
          bookingId: null,
          errorCode: null,
          summary: { serviceName: '<script>steal()</script>' },
        },
      },
    });

    expect(result.metadata).toEqual({
      operationId: 'operation-1',
      type: ChatOperationType.CREATE_BOOKING,
      status: ChatOperationStatus.SUCCEEDED,
      bookingId: 'booking-1',
      outcome: 'BOOKING_CREATED',
    });
    expect(forgedCard).not.toHaveProperty('metadata');
  });

  it('allows the public-safe appointments-listed result without private fields', () => {
    const result = toChatMessageResponse({
      id: 'message-5',
      conversationId: 'conversation-1',
      senderType: MessageSenderType.SYSTEM,
      body: 'لا توجد مواعيد مسجلة حاليًا.',
      kind: ChatMessageKind.OPERATION_RESULT,
      clientMessageId: null,
      createdAt: new Date('2026-08-13T10:04:00.000Z'),
      metadata: {
        operationId: 'operation-2',
        type: ChatOperationType.LIST_OWN_APPOINTMENTS,
        status: ChatOperationStatus.SUCCEEDED,
        bookingId: null,
        outcome: 'APPOINTMENTS_LISTED',
        clientId: 'must-not-leak',
      },
    });

    expect(result.metadata).toEqual({
      operationId: 'operation-2',
      type: ChatOperationType.LIST_OWN_APPOINTMENTS,
      status: ChatOperationStatus.SUCCEEDED,
      bookingId: null,
      outcome: 'APPOINTMENTS_LISTED',
    });
  });
});
