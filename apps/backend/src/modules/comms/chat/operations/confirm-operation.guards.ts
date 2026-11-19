import { ForbiddenException } from '@nestjs/common';
import type { ChatOperation, Prisma } from '@prisma/client';

export async function assertConversationOwnership(
  tx: Prisma.TransactionClient,
  operation: Pick<ChatOperation, 'conversationId'>,
  clientId: string,
): Promise<void> {
  const conversation = await tx.chatConversation.findFirst({
    where: { id: operation.conversationId, clientId },
    select: { id: true },
  });
  if (!conversation) throw new ForbiddenException('Conversation does not belong to this client');
}
