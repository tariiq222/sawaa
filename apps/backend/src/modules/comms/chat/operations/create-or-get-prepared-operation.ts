import { ChatOperationStatus, ChatOperationType, Prisma, type ChatOperation } from '@prisma/client';
import { PrismaService, RlsTransactionService } from '../../../../infrastructure/database';
import { assertAssistantOperationFence, type AssistantOperationFence } from './assistant-operation-fence';

export interface PreparedOperationData {
  conversationId: string;
  clientId: string | null;
  type: ChatOperationType;
  status: ChatOperationStatus;
  payload: object;
  summary: object;
  idempotencyKey: string;
  requiredConfirmations: number;
  expiresAt: Date;
  assistantFence?: AssistantOperationFence;
}

export async function createOrGetPreparedOperation(
  prisma: PrismaService,
  rlsTransaction: RlsTransactionService,
  data: PreparedOperationData,
): Promise<ChatOperation> {
  try {
    return await rlsTransaction.withTransaction(async (tx) => {
      await assertAssistantOperationFence(tx, data.conversationId, data.clientId, data.assistantFence);
      const existing = await tx.chatOperation.findUnique({ where: { idempotencyKey: data.idempotencyKey } });
      if (existing) return existing;

      const { assistantFence: _fence, ...persisted } = data;
      return tx.chatOperation.create({
        data: {
          ...persisted,
          payload: data.payload as Prisma.InputJsonValue,
          summary: data.summary as Prisma.InputJsonValue,
        },
      });
    });
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error;
    const existing = await prisma.chatOperation.findUnique({ where: { idempotencyKey: data.idempotencyKey } });
    if (!existing) throw error;
    return existing;
  }
}
