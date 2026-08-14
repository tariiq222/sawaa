import { ActivityAction } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { ChatAuditService, type ChatAuditEvent } from './chat-audit.service';

describe('ChatAuditService', () => {
  const conversationId = '00000000-0000-4000-a000-000000000001';
  const operationId = '00000000-0000-4000-a000-000000000002';
  let activityLog: { create: jest.Mock };
  let service: ChatAuditService;

  beforeEach(() => {
    activityLog = { create: jest.fn().mockResolvedValue({ id: 'audit-1' }) };
    service = new ChatAuditService({ activityLog } as unknown as PrismaService);
  });

  it.each<ChatAuditEvent>([
    { action: 'HANDOFF_REQUESTED', conversationId },
    { action: 'GUEST_CLAIMED', conversationId, clientId: 'client-1' },
    { action: 'STAFF_CLAIMED', conversationId, actorUserId: 'staff-1' },
    {
      action: 'STAFF_ASSIGNED',
      conversationId,
      actorUserId: 'admin-1',
      targetStaffUserId: 'staff-2',
    },
    { action: 'RELEASED_TO_AI', conversationId, actorUserId: 'staff-1' },
    { action: 'CONVERSATION_CLOSED', conversationId, actorUserId: 'staff-1' },
    { action: 'OPERATION_CONFIRMED', conversationId, operationId },
    { action: 'OPERATION_SUCCEEDED', conversationId, operationId },
    { action: 'OPERATION_FAILED', conversationId, operationId },
  ])('writes the semantic $action lifecycle event with IDs only', async (event) => {
    await service.record(event);

    expect(activityLog.create).toHaveBeenCalledTimes(1);
    const data = activityLog.create.mock.calls[0][0].data;
    expect(data).toEqual(
      expect.objectContaining({
        action: ActivityAction.SYSTEM,
        entity: event.action.startsWith('OPERATION_') ? 'ChatOperation' : 'ChatConversation',
        entityId: event.action.startsWith('OPERATION_') ? operationId : conversationId,
        description: event.action,
        metadata: expect.objectContaining({
          action: event.action,
          conversationId,
        }),
      }),
    );
  });

  it('drops message bodies, guest phones, and unknown personal fields at runtime', async () => {
    await service.record({
      action: 'STAFF_ASSIGNED',
      conversationId,
      actorUserId: 'admin-1',
      targetStaffUserId: 'staff-2',
      body: 'private message body',
      guestPhone: '+966501234567',
      personName: 'Private Person',
    } as ChatAuditEvent);

    const serialized = JSON.stringify(activityLog.create.mock.calls[0][0]);
    expect(serialized).not.toContain('private message body');
    expect(serialized).not.toContain('+966501234567');
    expect(serialized).not.toContain('Private Person');
  });

  it('can write into an existing transaction so the lifecycle mutation and audit commit together', async () => {
    const transactionActivityLog = {
      create: jest.fn().mockResolvedValue({ id: 'audit-tx' }),
    };

    await service.record({ action: 'OPERATION_SUCCEEDED', conversationId, operationId }, { activityLog: transactionActivityLog });

    expect(transactionActivityLog.create).toHaveBeenCalledTimes(1);
    expect(activityLog.create).not.toHaveBeenCalled();
  });
});
