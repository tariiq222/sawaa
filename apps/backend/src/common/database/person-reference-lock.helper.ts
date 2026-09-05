import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export type PersonReference = Readonly<{
  kind: 'Client' | 'Employee';
  id: string;
}>;

export function isSerializableTransactionConflict(error: unknown): boolean {
  const candidate = error as {
    code?: unknown;
    meta?: {
      code?: unknown;
      driverAdapterError?: { cause?: { originalCode?: unknown } };
    };
  } | null;
  return (
    candidate?.code === 'P2034' ||
    candidate?.code === '40001' ||
    candidate?.meta?.code === '40001' ||
    candidate?.meta?.driverAdapterError?.cause?.originalCode === '40001'
  );
}

/** Retry only a transaction owned by the current handler, with a fresh snapshot. */
export async function retrySerializableTransaction<T>(
  run: () => Promise<T>,
  maxAttempts = 2,
): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await run();
    } catch (error) {
      if (attempt >= maxAttempts || !isSerializableTransactionConflict(error)) {
        throw error;
      }
    }
  }
}

type LockedPersonRow = {
  id: string;
  isActive: boolean;
  deletedAt?: Date | null;
};

const KIND_ORDER: Record<PersonReference['kind'], number> = {
  Client: 0,
  Employee: 1,
};

/**
 * Lock person rows before a transaction creates, revives, or deletes a live
 * cross-boundary relationship.
 *
 * Global T2 ordering:
 * - deduplicate and lock people in Client -> Employee -> id order;
 * - enrollment/restore may already hold their Program row before people;
 * - ordinary/credit bookings take people before slot/coupon/credit/number locks;
 * - program supervisor writers take people before writing ProgramSupervisor;
 * - deletion takes only the person FOR UPDATE before relationship reads.
 *
 * The table and lock mode are selected only through exhaustive branches. IDs
 * remain query parameters; no caller-controlled SQL identifier is interpolated.
 */
export async function lockPersonReferences(
  tx: Prisma.TransactionClient,
  refs: ReadonlyArray<PersonReference>,
  mode: 'reference' | 'delete',
): Promise<void> {
  const ordered = [
    ...new Map(
      refs.map((ref) => [`${ref.kind}\0${ref.id}`, ref] as const),
    ).values(),
  ].sort((left, right) => {
    const kindDifference = KIND_ORDER[left.kind] - KIND_ORDER[right.kind];
    if (kindDifference !== 0) return kindDifference;
    return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
  });

  for (const ref of ordered) {
    let rows: LockedPersonRow[];
    if (ref.kind === 'Client') {
      rows =
        mode === 'reference'
          ? await tx.$queryRaw<LockedPersonRow[]>`
            SELECT id, "isActive", "deletedAt"
            FROM "Client"
            WHERE id = ${ref.id}
            FOR SHARE
          `
          : await tx.$queryRaw<LockedPersonRow[]>`
            SELECT id, "isActive", "deletedAt"
            FROM "Client"
            WHERE id = ${ref.id}
            FOR UPDATE
          `;
    } else {
      rows =
        mode === 'reference'
          ? await tx.$queryRaw<LockedPersonRow[]>`
            SELECT id, "isActive"
            FROM "Employee"
            WHERE id = ${ref.id}
            FOR SHARE
          `
          : await tx.$queryRaw<LockedPersonRow[]>`
            SELECT id, "isActive"
            FROM "Employee"
            WHERE id = ${ref.id}
            FOR UPDATE
          `;
    }

    if (mode === 'delete') continue;

    const row = rows[0];
    if (!row || (ref.kind === 'Client' && row.deletedAt != null)) {
      throw new NotFoundException(`${ref.kind} not found`);
    }
    if (row.isActive !== true) {
      throw new BadRequestException(`${ref.kind} is not active`);
    }
  }
}
