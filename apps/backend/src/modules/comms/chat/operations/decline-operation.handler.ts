import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ChatMessageKind,
  ChatOperationStatus,
  MessageSenderType,
  Prisma,
  type ChatOperation,
} from '@prisma/client';
import { RlsTransactionService } from '../../../../infrastructure/database';
import { lockChatConversation } from '../conversation-lock.helper';
import { assertOperationOwnership, lockChatOperation } from './acknowledge-existing-booking.handler';
import { ChatAuditService } from '../chat-audit.service';

export interface DeclineOperationCommand {
  operationId: string;
  clientId: string;
  expectedVersion: number;
}

@Injectable()
export class DeclineOperationHandler {
  constructor(
    private readonly rlsTransaction: RlsTransactionService,
    private readonly audit: ChatAuditService,
  ) {}

  execute(command: DeclineOperationCommand): Promise<ChatOperation> {
    return this.rlsTransaction.withTransaction(async (tx) => {
      await lockChatOperation(tx, command.operationId);
      const operation = await tx.chatOperation.findUnique({ where: { id: command.operationId } });
      if (!operation) throw new NotFoundException('Chat operation not found');
      assertOperationOwnership(operation, command.clientId);
      const conversation = await tx.chatConversation.findFirst({
        where: { id: operation.conversationId, clientId: command.clientId },
        select: { id: true },
      });
      if (!conversation) throw new ForbiddenException('Conversation does not belong to this client');

      if (
        operation.status === ChatOperationStatus.DECLINED ||
        operation.status === ChatOperationStatus.SUCCEEDED ||
        operation.status === ChatOperationStatus.FAILED ||
        operation.status === ChatOperationStatus.EXPIRED
      ) {
        return operation;
      }
      if (operation.expiresAt <= new Date()) {
        await tx.chatOperation.updateMany({
          where: { id: operation.id, version: operation.version, status: operation.status },
          data: { status: ChatOperationStatus.EXPIRED, version: { increment: 1 } },
        });
        return (await tx.chatOperation.findUnique({ where: { id: operation.id } }))!;
      }
      if (
        operation.status !== ChatOperationStatus.AWAITING_CONFIRMATION &&
        operation.status !== ChatOperationStatus.AWAITING_EXISTING_BOOKING_ACK
      ) {
        throw new BadRequestException('Operation cannot be declined in its current state');
      }
      if (operation.version !== command.expectedVersion) {
        throw new ConflictException('Operation version is stale');
      }
      const changed = await tx.chatOperation.updateMany({
        where: { id: operation.id, version: operation.version, status: operation.status },
        data: { status: ChatOperationStatus.DECLINED, version: { increment: 1 } },
      });
      if (changed.count !== 1) throw new ConflictException('Operation changed concurrently');

      await lockChatConversation(tx, operation.conversationId);
      const message = await tx.commsChatMessage.create({
        data: {
          conversationId: operation.conversationId,
          senderType: MessageSenderType.SYSTEM,
          senderId: null,
          body: 'تم إلغاء الطلب دون تنفيذ أي تغيير.',
          kind: ChatMessageKind.OPERATION_RESULT,
          metadata: {
            operationId: operation.id,
            type: operation.type,
            status: ChatOperationStatus.DECLINED,
          },
        },
      });
      await tx.chatConversation.update({
        where: { id: operation.conversationId },
        data: {
          stateVersion: { increment: 1 },
          assistantLeaseOwner: null,
          assistantLeaseExpiresAt: null,
          lastMessageAt: new Date(),
          clientUnreadCount: { increment: 1 },
        },
      });
      const declined = await tx.chatOperation.update({
        where: { id: operation.id },
        data: { resultMessageId: message.id },
      });
      await this.audit.record({
        action: 'OPERATION_DECLINED',
        conversationId: operation.conversationId,
        operationId: operation.id,
      }, tx);
      return declined;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}
