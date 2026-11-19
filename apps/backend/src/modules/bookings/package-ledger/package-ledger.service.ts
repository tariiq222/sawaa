import { Injectable } from '@nestjs/common';
import {
  PackageCreditUsageStatus,
  PackagePurchaseStatus,
  Prisma,
} from '@prisma/client';
import type {
  LockedPackagePurchase,
  MarkPackagePurchaseRefundInput,
} from './package-ledger.types';

/**
 * The narrow package-ledger seam (MNT-17.1b).
 *
 * `PackagePurchase*` tables are declared in `bookings.prisma`, so `bookings`
 * owns them and this service is the only writer finance may use. It receives
 * already-computed rows: pricing, snapshots and eligibility policy stay in
 * finance, where they are decided.
 *
 * Every method takes the caller's `Prisma.TransactionClient` and performs one
 * kind of write. No method opens a transaction or reorders caller locks.
 */
@Injectable()
export class PackageLedgerService {
  /** Creates the purchase row. P2002 is left to the caller, exactly as today. */
  async createPackagePurchaseInTx(
    tx: Prisma.TransactionClient,
    data: Prisma.PackagePurchaseUncheckedCreateInput,
  ): Promise<{ id: string }> {
    const row = await tx.packagePurchase.create({ data, select: { id: true } });
    return { id: row.id };
  }

  /**
   * Creates one credit row. Callers pass the same `data` object they used to
   * pass to `tx.packageCredit.create`, including nested `constraints.create`.
   */
  async createPackageCreditInTx(
    tx: Prisma.TransactionClient,
    data: Prisma.PackageCreditCreateArgs['data'],
  ): Promise<void> {
    await tx.packageCredit.create({ data });
  }

  /** Creates one purchase-group row and returns its id for dependency linking. */
  async createPackagePurchaseGroupInTx(
    tx: Prisma.TransactionClient,
    data: Prisma.PackagePurchaseGroupUncheckedCreateInput,
  ): Promise<{ id: string }> {
    const row = await tx.packagePurchaseGroup.create({
      data,
      select: { id: true },
    });
    return { id: row.id };
  }

  /** Links a group to its predecessor. Pure metadata write. */
  async linkPackagePurchaseGroupDependencyInTx(
    tx: Prisma.TransactionClient,
    input: { groupId: string; dependsOnGroupId: string },
  ): Promise<void> {
    await tx.packagePurchaseGroup.update({
      where: { id: input.groupId },
      data: { dependsOnGroupId: input.dependsOnGroupId },
      select: { id: true },
    });
  }

  /**
   * Flips PENDING → ACTIVE atomically. `activated: false` means a concurrent
   * delivery won, so the caller must issue no credits.
   */
  async activatePendingPackagePurchaseInTx(
    tx: Prisma.TransactionClient,
    input: { purchaseId: string; paidAt: Date },
  ): Promise<{ activated: boolean }> {
    const { count } = await tx.packagePurchase.updateMany({
      where: { id: input.purchaseId, status: PackagePurchaseStatus.PENDING },
      data: { status: PackagePurchaseStatus.ACTIVE, paidAt: input.paidAt },
    });
    return { activated: count > 0 };
  }

  /** Row lock only. Moved here so the owning module holds its own lock. */
  async lockPackagePurchaseForRefundInTx(
    tx: Prisma.TransactionClient,
    input: { purchaseId: string },
  ): Promise<LockedPackagePurchase | null> {
    const rows = await tx.$queryRaw<
      Array<{
        id: string;
        status: PackagePurchaseStatus;
        amountPaid: Prisma.Decimal;
        refundAmount: Prisma.Decimal | null;
        clientId: string;
        notes: string | null;
      }>
    >`SELECT id, status, "amountPaid", "refundAmount", "clientId", notes
        FROM "PackagePurchase"
        WHERE id = ${input.purchaseId}
        FOR UPDATE`;
    return rows[0] ?? null;
  }

  /**
   * Updates the refund fields behind a `status != REFUNDED` guard.
   * `updated: false` means another transaction already refunded the purchase.
   */
  async markPackagePurchaseRefundInTx(
    tx: Prisma.TransactionClient,
    input: MarkPackagePurchaseRefundInput,
  ): Promise<{ updated: boolean }> {
    const { count } = await tx.packagePurchase.updateMany({
      where: {
        id: input.purchaseId,
        status: { not: PackagePurchaseStatus.REFUNDED },
      },
      data: {
        status: input.status,
        refundedAt: input.refundedAt,
        refundAmount: input.refundAmount,
        notes: input.notes,
      },
    });
    return { updated: count > 0 };
  }

  /**
   * Full-refund credit void. Uses raw SQL on purpose: it pins
   * `usedQuantity = totalQuantity` and zeroes `reservedQuantity` in one
   * statement, matching the existing behaviour exactly.
   */
  async voidPackageCreditsInTx(
    tx: Prisma.TransactionClient,
    input: { purchaseId: string },
  ): Promise<void> {
    await tx.$executeRaw`
      UPDATE "PackageCredit"
      SET "usedQuantity" = "totalQuantity", "reservedQuantity" = 0
      WHERE "purchaseId" = ${input.purchaseId}
    `;
  }

  /**
   * Terminates RESERVED usages so no later consume can overshoot the voided
   * totals. CONSUMED rows are deliberately left untouched.
   */
  async terminateReservedUsagesInTx(
    tx: Prisma.TransactionClient,
    input: { purchaseId: string; at: Date },
  ): Promise<{ terminated: number }> {
    const { count } = await tx.packageCreditUsage.updateMany({
      where: {
        credit: { purchaseId: input.purchaseId },
        status: PackageCreditUsageStatus.RESERVED,
      },
      data: {
        status: PackageCreditUsageStatus.RETURNED,
        returnedAt: input.at,
      },
    });
    return { terminated: count };
  }
}
