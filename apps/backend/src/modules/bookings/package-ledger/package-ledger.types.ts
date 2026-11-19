import type { PackagePurchaseStatus, Prisma } from '@prisma/client';

/** What a caller must already hold: nothing. The service never opens a tx. */
export interface LockedPackagePurchase {
  id: string;
  status: PackagePurchaseStatus;
  amountPaid: Prisma.Decimal;
  refundAmount: Prisma.Decimal | null;
  clientId: string;
  notes: string | null;
}

export interface MarkPackagePurchaseRefundInput {
  purchaseId: string;
  status: PackagePurchaseStatus;
  refundedAt: Date | undefined;
  refundAmount: Prisma.Decimal;
  notes: string;
}
