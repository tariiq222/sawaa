import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { BundlePurchaseStatus, DeliveryType, Prisma } from '@prisma/client';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';

export interface UseBundleCommand {
  purchaseId: string;
  serviceId: string;
  bookingId?: string;
  deliveryType?: DeliveryType;
  quantityUsed?: number;
  notes?: string;
}

@Injectable()
export class UseBundleHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rlsTransaction: RlsTransactionService,
  ) {}

  async execute(cmd: UseBundleCommand) {
    const quantityToUse = cmd.quantityUsed ?? 1;
    if (quantityToUse < 1) {
      throw new BadRequestException('quantityUsed must be at least 1');
    }

    // SECURITY (P0-16): the capacity check + write MUST run atomically under
    // Serializable isolation, with a row lock on the purchase. The previous
    // implementation read `totalUsed` outside the transaction and wrote
    // `bundleUsage` without re-checking, letting two concurrent calls each
    // observe `remaining = 1` and both succeed — silent overbooking that
    // gave the client extra free sessions.
    return this.rlsTransaction.withTransaction(
      async (tx) => {
        // SELECT ... FOR UPDATE on the purchase row to serialize concurrent uses.
        // Prisma exposes this only via raw SQL.
        const lockedRows = await tx.$queryRaw<Array<{ id: string; status: string; bundleId: string }>>`
          SELECT id, status, "bundleId" FROM "BundlePurchase" WHERE id = ${cmd.purchaseId} FOR UPDATE
        `;
        if (lockedRows.length === 0) throw new NotFoundException('Bundle purchase not found');
        const locked = lockedRows[0];
        if (locked.status !== BundlePurchaseStatus.ACTIVE) {
          throw new BadRequestException('Bundle purchase is not active');
        }

        const bundle = await tx.serviceBundle.findFirst({
          where: { id: locked.bundleId, archivedAt: null },
          include: { items: true },
        });
        if (!bundle) throw new NotFoundException('Service bundle not found');

        const bundleItem = bundle.items.find((i) => i.serviceId === cmd.serviceId);
        if (!bundleItem) {
          throw new BadRequestException('Service is not part of this bundle');
        }

        const totalQuantity = bundle.items.length;
        // Recount usages INSIDE the transaction — must not be stale.
        const usageAgg = await tx.bundleUsage.aggregate({
          where: { purchaseId: cmd.purchaseId },
          _sum: { quantityUsed: true },
        });
        const totalUsed = usageAgg._sum.quantityUsed ?? 0;

        if (totalUsed + quantityToUse > totalQuantity) {
          throw new ConflictException('Bundle usage limit exceeded');
        }

        const usage = await tx.bundleUsage.create({
          data: {
            purchaseId: cmd.purchaseId,
            bookingId: cmd.bookingId ?? null,
            serviceId: cmd.serviceId,
            deliveryType: cmd.deliveryType ?? DeliveryType.IN_PERSON,
            quantityUsed: quantityToUse,
            notes: cmd.notes,
          },
        });

        if (totalUsed + quantityToUse >= totalQuantity) {
          await tx.bundlePurchase.update({
            where: { id: cmd.purchaseId },
            data: { status: BundlePurchaseStatus.COMPLETED },
          });
        }

        return usage;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
}
