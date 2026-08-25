import { ChatOperationStatus, ChatOperationType } from '@prisma/client';
import { toOperationCardMetadata, toPublicChatOperation } from './chat-operation-public.mapper';

describe('chat operation public mapper', () => {
  it('keeps deterministic display fields and removes payload/internal or unsafe summary data', () => {
    const operation: any = {
      id: 'operation-1', type: ChatOperationType.CREATE_BOOKING,
      status: ChatOperationStatus.AWAITING_EXISTING_BOOKING_ACK,
      version: 2, requiredConfirmations: 2, confirmationCount: 0,
      expiresAt: new Date('2026-08-13T09:15:00.000Z'), bookingId: null,
      payload: { clientId: 'secret-client', employeeId: 'secret-employee', price: 300 },
      idempotencyKey: 'secret-key', conversationId: 'secret-conversation', clientId: 'secret-client',
      summary: {
        action: 'CREATE_BOOKING',
        proposedBooking: {
          serviceName: 'جلسة إرشاد أسري', employeeName: 'د. سارة', branchName: 'فرع الرياض',
          scheduledAt: '2026-08-20T09:00:00.000Z', durationMins: 60, price: 300,
          currency: 'SAR', deliveryType: 'IN_PERSON', employeeId: 'secret-employee',
        },
        existingBooking: {
          serviceName: '<script>steal()</script>', scheduledAt: '2026-08-18T09:00:00.000Z',
          bookingId: 'secret-booking',
        },
      },
    };

    const publicView = toPublicChatOperation(operation);
    const metadata = toOperationCardMetadata(operation);

    expect(publicView).toEqual({
      id: 'operation-1', type: ChatOperationType.CREATE_BOOKING,
      status: ChatOperationStatus.AWAITING_EXISTING_BOOKING_ACK,
      version: 2, requiredConfirmations: 2, confirmationCount: 0,
      expiresAt: '2026-08-13T09:15:00.000Z', bookingId: null,
      errorCode: null,
      summary: {
        action: 'CREATE_BOOKING',
        proposedBooking: {
          serviceName: 'جلسة إرشاد أسري', employeeName: 'د. سارة', branchName: 'فرع الرياض',
          scheduledAt: '2026-08-20T09:00:00.000Z', durationMins: 60, price: 300,
          currency: 'SAR', deliveryType: 'IN_PERSON',
        },
        existingBooking: { scheduledAt: '2026-08-18T09:00:00.000Z' },
      },
    });
    expect(metadata).toEqual({ action: 'CHAT_OPERATION', operation: publicView });
    expect(JSON.stringify(metadata)).not.toMatch(/secret|script|idempotencyKey|clientId|employeeId/);
  });
});
