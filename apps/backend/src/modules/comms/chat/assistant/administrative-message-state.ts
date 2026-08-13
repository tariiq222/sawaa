import { Prisma } from '@prisma/client';

export type AdministrativeMessageState = Record<string, unknown> & {
  assistantStatus?: 'QUEUED' | 'RETRYING' | 'RETRYABLE_FAILURE';
  retryable?: boolean;
  retryAttempts?: number;
  dispatchAttempt?: number;
  queuedAt?: string;
  assistantStateVersion?: number;
  assistantClientId?: string | null;
};

export function readAdministrativeMessageState(value: Prisma.JsonValue | null): AdministrativeMessageState {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as AdministrativeMessageState
    : {};
}

export function readNonNegativeInteger(value: unknown): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

export function queuedAdministrativeMessageState(input: {
  status: 'QUEUED' | 'RETRYING';
  dispatchAttempt: number;
  retryAttempts?: number;
  assistantStateVersion: number;
  assistantClientId: string | null;
  now?: Date;
}): Prisma.InputJsonObject {
  return {
    assistantStatus: input.status,
    retryable: false,
    ...(input.retryAttempts === undefined ? {} : { retryAttempts: input.retryAttempts }),
    dispatchAttempt: input.dispatchAttempt,
    queuedAt: (input.now ?? new Date()).toISOString(),
    assistantStateVersion: input.assistantStateVersion,
    assistantClientId: input.assistantClientId,
  };
}
