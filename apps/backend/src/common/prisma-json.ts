import type { Prisma } from '@prisma/client';

/**
 * Casts an object to Prisma's InputJsonValue type.
 *
 * Prisma represents JSON columns as a union of literal types that doesn't
 * include plain Record<string, unknown>. This helper centralises the cast so
 * that callers don't scatter `as any` across the codebase.
 *
 * Usage:
 *   config: asPrismaJson(cmd.config)
 */
export function asPrismaJson<T>(value: T): Prisma.InputJsonValue {
  return value as unknown as Prisma.InputJsonValue;
}
