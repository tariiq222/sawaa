import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ChatOperationStatus, Prisma, type ChatOperation } from '@prisma/client';
import { RlsTransactionService } from '../../../../infrastructure/database';

const TERMINAL_STATUSES = new Set<ChatOperationStatus>([
  ChatOperationStatus.SUCCEEDED,
  ChatOperationStatus.FAILED,
  ChatOperationStatus.DECLINED,
  ChatOperationStatus.EXPIRED,
]);

export interface AcknowledgeExistingBookingCommand {
  operationId: string;
  clientId: string;
  expectedVersion: number;
}

export async function lockChatOperation(
  tx: Pick<Prisma.TransactionClient, '$queryRaw'>,
  operationId: string,
): Promise<void> {
  await tx.$queryRaw`SELECT "id" FROM "ChatOperation" WHERE "id" = ${operationId} FOR UPDATE`;
}

export function assertOperationOwnership(
  operation: Pick<ChatOperation, 'clientId'>,
  clientId: string,
): void {
  if (!operation.clientId || operation.clientId !== clientId) {
    throw new ForbiddenException('Operation does not belong to this client');
  }
}

@Injectable()
export class AcknowledgeExistingBookingHandler {
  constructor(private readonly rlsTransaction: RlsTransactionService) {}

  execute(command: AcknowledgeExistingBookingCommand): Promise<ChatOperation> {
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

      if (TERMINAL_STATUSES.has(operation.status)) {
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
        operation.status === ChatOperationStatus.AWAITING_CONFIRMATION &&
        operation.requiredConfirmations === 2 &&
        operation.confirmationCount >= 1
      ) {
        return operation;
      }
      if (operation.status !== ChatOperationStatus.AWAITING_EXISTING_BOOKING_ACK) {
        throw new BadRequestException('Operation is not awaiting an additional-booking acknowledgement');
      }
      if (operation.version !== command.expectedVersion) {
        throw new ConflictException('Operation version is stale');
      }
      const updated = await tx.chatOperation.updateMany({
        where: {
          id: operation.id,
          version: operation.version,
          status: ChatOperationStatus.AWAITING_EXISTING_BOOKING_ACK,
        },
        data: {
          status: ChatOperationStatus.AWAITING_CONFIRMATION,
          confirmationCount: { increment: 1 },
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1) throw new ConflictException('Operation changed concurrently');
      return (await tx.chatOperation.findUnique({ where: { id: operation.id } }))!;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}
