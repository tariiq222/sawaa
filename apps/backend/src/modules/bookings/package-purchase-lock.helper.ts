import { PackagePurchaseStatus, Prisma } from '@prisma/client';

export interface LockedPackagePurchase {
  id: string;
  status: PackagePurchaseStatus;
}

/** Lock the parent purchase before reading or mutating package credits. */
export async function lockPackagePurchase(
  tx: Prisma.TransactionClient,
  purchaseId: string,
): Promise<LockedPackagePurchase | null> {
  const rows = await tx.$queryRaw<LockedPackagePurchase[]>`
    SELECT id, status
    FROM "PackagePurchase"
    WHERE id = ${purchaseId}
    FOR UPDATE
  `;
  return rows[0] ?? null;
}
