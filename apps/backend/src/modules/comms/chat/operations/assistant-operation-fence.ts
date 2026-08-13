import { ConflictException } from '@nestjs/common';
import { ConversationStatus, type Prisma } from '@prisma/client';

export interface AssistantOperationFence {
  stateVersion: number;
  leaseOwner: string;
}

export async function assertAssistantOperationFence(
  tx: Prisma.TransactionClient,
  conversationId: string,
  clientId: string | null,
  fence?: AssistantOperationFence,
): Promise<void> {
  if (!fence) return;
  await tx.$queryRaw`SELECT "id" FROM "ChatConversation" WHERE "id" = ${conversationId} FOR UPDATE`;
  const conversation = await tx.chatConversation.findFirst({
    where: {
      id: conversationId,
      clientId,
      status: ConversationStatus.AI_ACTIVE,
      isAiChat: true,
      stateVersion: fence.stateVersion,
      assistantLeaseOwner: fence.leaseOwner,
      assistantLeaseExpiresAt: { gt: new Date() },
    },
    select: { id: true },
  });
  if (!conversation) throw new ConflictException('Administrative assistant state changed');
}
