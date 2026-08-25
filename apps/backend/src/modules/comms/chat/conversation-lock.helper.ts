import { Prisma } from '@prisma/client';

const CHAT_CONVERSATION_LOCK_NAMESPACE = 0x53415741;

function conversationLockKey(conversationId: string): number {
  let hash = 0x811c9dc5;
  for (const character of conversationId) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193);
  }
  return hash | 0;
}

export async function lockChatConversation(
  tx: Pick<Prisma.TransactionClient, '$executeRaw'>,
  conversationId: string,
): Promise<void> {
  const key = conversationLockKey(conversationId);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${CHAT_CONVERSATION_LOCK_NAMESPACE}::int, ${key}::int)`;
}
