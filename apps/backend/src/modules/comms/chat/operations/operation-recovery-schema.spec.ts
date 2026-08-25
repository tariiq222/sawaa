import { ChatOperationType, Prisma } from '@prisma/client';

describe('chat operation recovery schema', () => {
  it('persists durable mutation keys/results and the operation result message id', () => {
    const statusLog = Prisma.validator<Prisma.BookingStatusLogUncheckedCreateInput>()({
      bookingId: 'booking-1',
      fromStatus: 'CONFIRMED',
      toStatus: 'CONFIRMED',
      changedBy: 'client-1',
      sourceActionId: '00000000-0000-4000-a000-000000000001',
      sourceActionHash: 'sha256',
      sourceActionResult: { status: 'RESCHEDULED' },
    });
    const operation = Prisma.validator<Prisma.ChatOperationUncheckedCreateInput>()({
      conversationId: 'conversation-1',
      clientId: 'client-1',
      type: 'CREATE_BOOKING',
      status: 'SUCCEEDED',
      payload: {},
      summary: {},
      idempotencyKey: 'operation-key',
      requiredConfirmations: 1,
      expiresAt: new Date(),
      resultMessageId: 'message-1',
    });

    expect(statusLog.sourceActionId).toBeDefined();
    expect(operation.resultMessageId).toBe('message-1');
    expect(ChatOperationType.LIST_OWN_APPOINTMENTS).toBe('LIST_OWN_APPOINTMENTS');
  });
});
