import type {
  ChatOperation,
  ChatOperationStatus,
  ChatOperationType,
  Prisma,
} from '@prisma/client';
import { isDeepStrictEqual } from 'node:util';

const DISPLAY_KEYS = new Set([
  'action', 'intent', 'existingBooking', 'proposedBooking',
  'scheduledAt', 'endsAt', 'oldScheduledAt', 'newScheduledAt', 'newEndsAt',
  'durationMins', 'price', 'currency', 'serviceName', 'employeeName', 'branchName',
  'deliveryType', 'status',
]);
const DATE_KEYS = new Set(['scheduledAt', 'endsAt', 'oldScheduledAt', 'newScheduledAt', 'newEndsAt']);
const NAME_KEYS = new Set(['serviceName', 'employeeName', 'branchName']);
const UPPERCASE_VALUE_KEYS = new Set(['action', 'intent', 'deliveryType', 'status']);
const UNSAFE_MARKUP_OR_SCHEME = /[<>{}]|\[|\]|https?:\/\/|javascript:/iu;
const SAFE_LABEL = /^[\p{L}\p{N} .,'’&()/_-]+$/u;

export interface PublicChatOperation {
  id: string;
  type: ChatOperationType;
  status: ChatOperationStatus;
  version: number;
  requiredConfirmations: number;
  confirmationCount: number;
  expiresAt: string;
  bookingId: string | null;
  errorCode: string | null;
  summary: Record<string, unknown>;
}

type OperationSource = Pick<
  ChatOperation,
  'id' | 'type' | 'status' | 'version' | 'requiredConfirmations' | 'confirmationCount'
  | 'expiresAt' | 'bookingId' | 'errorCode' | 'summary'
>;

export interface ChatOperationCardMetadata {
  action: 'CHAT_OPERATION';
  operation: PublicChatOperation;
}

export function toPublicChatOperation(operation: OperationSource): PublicChatOperation {
  return {
    id: operation.id,
    type: operation.type,
    status: operation.status,
    version: operation.version,
    requiredConfirmations: operation.requiredConfirmations,
    confirmationCount: operation.confirmationCount,
    expiresAt: operation.expiresAt.toISOString(),
    bookingId: operation.bookingId ?? null,
    errorCode: operation.errorCode ?? null,
    summary: sanitizeSummary(operation.summary),
  };
}

export function toOperationCardMetadata(operation: OperationSource): ChatOperationCardMetadata {
  return { action: 'CHAT_OPERATION', operation: toPublicChatOperation(operation) };
}

export function isPublicChatOperation(value: unknown): value is PublicChatOperation {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const operation = value as Record<string, unknown>;
  const allowedKeys = [
    'id', 'type', 'status', 'version', 'requiredConfirmations', 'confirmationCount',
    'expiresAt', 'bookingId', 'errorCode', 'summary',
  ];
  const expiresAt = typeof operation.expiresAt === 'string' ? new Date(operation.expiresAt) : null;
  if (
    Object.keys(operation).length !== allowedKeys.length
    || Object.keys(operation).some((key) => !allowedKeys.includes(key))
    || typeof operation.id !== 'string'
    || operation.id.length === 0
    || operation.id.length > 100
    || !['LIST_OWN_APPOINTMENTS', 'CREATE_BOOKING', 'RESCHEDULE_BOOKING', 'CANCEL_BOOKING'].includes(String(operation.type))
    || ![
      'AWAITING_AUTH', 'AWAITING_EXISTING_BOOKING_ACK', 'AWAITING_CONFIRMATION',
      'EXECUTING', 'SUCCEEDED', 'FAILED', 'DECLINED', 'EXPIRED',
    ].includes(String(operation.status))
    || !Number.isInteger(operation.version) || Number(operation.version) < 0
    || !Number.isInteger(operation.requiredConfirmations) || Number(operation.requiredConfirmations) < 0
    || !Number.isInteger(operation.confirmationCount) || Number(operation.confirmationCount) < 0
    || !expiresAt || Number.isNaN(expiresAt.getTime())
    || (operation.bookingId !== null && typeof operation.bookingId !== 'string')
    || (operation.errorCode !== null && (
      typeof operation.errorCode !== 'string' || !/^[A-Z][A-Z0-9_]{1,63}$/.test(operation.errorCode)
    ))
    || !operation.summary || typeof operation.summary !== 'object' || Array.isArray(operation.summary)
  ) return false;
  const summary = operation.summary as Prisma.JsonObject;
  return JSON.stringify(summary).length <= 4_000
    && isDeepStrictEqual(summary, sanitizeSummary(summary));
}

function sanitizeSummary(value: Prisma.JsonValue, depth = 0): Record<string, unknown> {
  if (!value || Array.isArray(value) || typeof value !== 'object' || depth > 2) return {};
  const result: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(value)) {
    if (raw === undefined) continue;
    if (!DISPLAY_KEYS.has(key)) continue;
    if (key === 'existingBooking' || key === 'proposedBooking') {
      const nested = sanitizeSummary(raw, depth + 1);
      if (Object.keys(nested).length > 0) result[key] = nested;
      continue;
    }
    const sanitized = sanitizeValue(key, raw);
    if (sanitized !== undefined) result[key] = sanitized;
  }
  return result;
}

function sanitizeValue(key: string, value: Prisma.JsonValue): string | number | undefined {
  if ((key === 'durationMins' || key === 'price') && typeof value === 'number') {
    return Number.isFinite(value) && value >= 0 ? value : undefined;
  }
  if (typeof value !== 'string' || value.length === 0 || value.length > 160) return undefined;
  if (DATE_KEYS.has(key)) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
  }
  if (key === 'currency') return /^[A-Z]{3}$/.test(value) ? value : undefined;
  if (UPPERCASE_VALUE_KEYS.has(key)) return /^[A-Z][A-Z0-9_]{1,63}$/.test(value) ? value : undefined;
  if (NAME_KEYS.has(key)) {
    const normalized = value.normalize('NFKC').trim().replace(/\s+/gu, ' ');
    return !hasUnsafeText(normalized) && SAFE_LABEL.test(normalized) ? normalized : undefined;
  }
  return undefined;
}

function hasUnsafeText(value: string): boolean {
  return UNSAFE_MARKUP_OR_SCHEME.test(value)
    || [...value].some((character) => {
      const codePoint = character.codePointAt(0);
      return codePoint !== undefined && (codePoint < 0x20 || codePoint === 0x7f);
    });
}
