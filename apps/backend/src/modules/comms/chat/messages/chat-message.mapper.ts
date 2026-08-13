import {
  ChatMessageKind,
  ChatOperationStatus,
  ChatOperationType,
  type MessageSenderType,
} from '@prisma/client';
import {
  isPublicChatOperation,
  type ChatOperationCardMetadata,
} from '../operations/chat-operation-public.mapper';

const OPERATION_RESULT_OUTCOMES = new Set([
  'BOOKING_CREATED',
  'BOOKING_RESCHEDULED',
  'BOOKING_CANCELLED',
  'CANCELLATION_REQUESTED',
  'OPERATION_FAILED',
  'APPOINTMENTS_LISTED',
]);
const OPERATION_TYPES = new Set(Object.values(ChatOperationType));
const OPERATION_RESULT_STATUSES = new Set<ChatOperationStatus>([
  ChatOperationStatus.SUCCEEDED,
  ChatOperationStatus.FAILED,
  ChatOperationStatus.DECLINED,
]);

export interface PublicChatHandoffMetadata {
  action: 'OFFER_HANDOFF';
  reason: 'OUT_OF_SCOPE' | 'USER_REQUESTED' | 'LIMIT_REACHED';
}

export interface PublicChatOperationResultMetadata {
  operationId: string;
  type: ChatOperationType;
  status:
    | typeof ChatOperationStatus.SUCCEEDED
    | typeof ChatOperationStatus.FAILED
    | typeof ChatOperationStatus.DECLINED;
  bookingId?: string | null;
  outcome?: string;
  syncPending?: boolean;
}

export interface PublicChatAssistantRecoveryMetadata {
  action: 'ASSISTANT_RECOVERY';
  canRetry: boolean;
}

export type PublicChatMessageMetadata =
  | PublicChatHandoffMetadata
  | PublicChatAssistantRecoveryMetadata
  | ChatOperationCardMetadata
  | PublicChatOperationResultMetadata;

export interface ChatMessageResponse {
  id: string;
  conversationId: string;
  senderType: MessageSenderType;
  body: string;
  kind: ChatMessageKind;
  clientMessageId: string | null;
  createdAt: Date;
  metadata?: PublicChatMessageMetadata;
}

type ChatMessageSource = Omit<ChatMessageResponse, 'metadata'> & { metadata?: unknown };

export function toChatMessageResponse<T extends ChatMessageSource>(message: T): ChatMessageResponse {
  const metadata = toPublicMetadata(message.kind, message.senderType, message.metadata);
  return {
    id: message.id,
    conversationId: message.conversationId,
    senderType: message.senderType,
    body: message.body,
    kind: message.kind,
    clientMessageId: message.clientMessageId,
    createdAt: message.createdAt,
    ...(metadata ? { metadata } : {}),
  };
}

function toPublicMetadata(
  kind: ChatMessageKind,
  senderType: MessageSenderType,
  value: unknown,
): PublicChatMessageMetadata | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const metadata = value as Record<string, unknown>;

  if (
    kind === ChatMessageKind.TEXT
    && (senderType === 'CLIENT' || senderType === 'VISITOR')
    && metadata.assistantStatus === 'RETRYABLE_FAILURE'
    && metadata.retryable === true
  ) {
    const attempts = typeof metadata.retryAttempts === 'number'
      && Number.isSafeInteger(metadata.retryAttempts)
      && metadata.retryAttempts >= 0
      ? metadata.retryAttempts
      : 0;
    return { action: 'ASSISTANT_RECOVERY', canRetry: attempts < 2 };
  }

  if (
    kind === ChatMessageKind.ACTION_CARD
    && metadata.action === 'CHAT_OPERATION'
    && isPublicChatOperation(metadata.operation)
  ) {
    return { action: 'CHAT_OPERATION', operation: metadata.operation };
  }

  if (
    metadata.action === 'OFFER_HANDOFF'
    && ['OUT_OF_SCOPE', 'USER_REQUESTED', 'LIMIT_REACHED'].includes(String(metadata.reason))
  ) {
    return {
      action: 'OFFER_HANDOFF',
      reason: metadata.reason as PublicChatHandoffMetadata['reason'],
    };
  }

  if (kind !== ChatMessageKind.OPERATION_RESULT) return null;
  if (
    !isSafeId(metadata.operationId)
    || !OPERATION_TYPES.has(metadata.type as ChatOperationType)
    || !OPERATION_RESULT_STATUSES.has(metadata.status as ChatOperationStatus)
  ) return null;

  const result: PublicChatOperationResultMetadata = {
    operationId: metadata.operationId,
    type: metadata.type as ChatOperationType,
    status: metadata.status as PublicChatOperationResultMetadata['status'],
  };
  if (metadata.status === ChatOperationStatus.DECLINED) return result;
  if (
    (metadata.bookingId !== null && !isSafeId(metadata.bookingId))
    || typeof metadata.outcome !== 'string'
    || !OPERATION_RESULT_OUTCOMES.has(metadata.outcome)
  ) return null;
  return {
    ...result,
    bookingId: metadata.bookingId,
    outcome: metadata.outcome,
    ...(metadata.syncPending === true ? { syncPending: true } : {}),
  };
}

function isSafeId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(value);
}
