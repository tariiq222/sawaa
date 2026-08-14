import { Injectable } from '@nestjs/common';
import { ActivityAction, Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';

type ConversationAuditEvent =
  | { action: 'HANDOFF_REQUESTED'; conversationId: string }
  | { action: 'GUEST_CLAIMED'; conversationId: string; clientId: string }
  | { action: 'STAFF_CLAIMED'; conversationId: string; actorUserId: string }
  | {
      action: 'STAFF_ASSIGNED';
      conversationId: string;
      actorUserId: string;
      targetStaffUserId: string;
    }
  | { action: 'RELEASED_TO_AI'; conversationId: string; actorUserId: string }
  | {
      action: 'CONVERSATION_CLOSED';
      conversationId: string;
      actorUserId?: string;
    };

type OperationAuditEvent = {
  action: 'OPERATION_CONFIRMED' | 'OPERATION_SUCCEEDED' | 'OPERATION_FAILED';
  conversationId: string;
  operationId: string;
};

export type ChatAuditEvent = ConversationAuditEvent | OperationAuditEvent;

export interface ChatAuditWriter {
  activityLog: {
    create(args: {
      data: {
        userId?: string;
        action: ActivityAction;
        entity: string;
        entityId: string;
        description: string;
        metadata: Prisma.InputJsonValue;
      };
    }): Promise<unknown>;
  };
}

@Injectable()
export class ChatAuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(event: ChatAuditEvent, writer: ChatAuditWriter = this.prisma): Promise<void> {
    const operationEvent = event.action.startsWith('OPERATION_');
    const metadata: Record<string, string> = {
      action: event.action,
      conversationId: event.conversationId,
    };
    let userId: string | undefined;

    if (operationEvent) {
      metadata.operationId = (event as OperationAuditEvent).operationId;
    } else {
      const conversationEvent = event as ConversationAuditEvent;
      if ('clientId' in conversationEvent) metadata.clientId = conversationEvent.clientId;
      if ('actorUserId' in conversationEvent && conversationEvent.actorUserId) {
        userId = conversationEvent.actorUserId;
        metadata.actorUserId = conversationEvent.actorUserId;
      }
      if ('targetStaffUserId' in conversationEvent) {
        metadata.targetStaffUserId = conversationEvent.targetStaffUserId;
      }
    }

    await writer.activityLog.create({
      data: {
        ...(userId ? { userId } : {}),
        action: ActivityAction.SYSTEM,
        entity: operationEvent ? 'ChatOperation' : 'ChatConversation',
        entityId: operationEvent ? (event as OperationAuditEvent).operationId : event.conversationId,
        description: event.action,
        metadata,
      },
    });
  }
}
