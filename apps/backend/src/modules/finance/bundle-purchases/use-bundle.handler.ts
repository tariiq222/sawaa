import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { BundlePurchaseStatus, DeliveryType } from '@prisma/client';
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
    const purchase = await this.prisma.bundlePurchase.findFirst({
      where: { id: cmd.purchaseId },
      include: { usages: true },
    });
    if (!purchase) throw new NotFoundException('Bundle purchase not found');
    if (purchase.status !== BundlePurchaseStatus.ACTIVE) {
      throw new BadRequestException('Bundle purchase is not active');
    }

    // Fetch bundle separately since bundleId is a plain string (cross-BC)
    const bundle = await this.prisma.serviceBundle.findFirst({
      where: { id: purchase.bundleId, archivedAt: null },
      include: { items: { include: { service: true } } },
    });
    if (!bundle) throw new NotFoundException('Service bundle not found');

    // Verify the service is part of the bundle
    const bundleItem = bundle.items.find((i) => i.serviceId === cmd.serviceId);
    if (!bundleItem) {
      throw new BadRequestException('Service is not part of this bundle');
    }

    // Count total usages
    const totalUsed = purchase.usages.reduce((sum, u) => sum + u.quantityUsed, 0);
    const totalQuantity = bundle.items.length;
    const quantityToUse = cmd.quantityUsed ?? 1;

    if (totalUsed + quantityToUse > totalQuantity) {
      throw new BadRequestException('Bundle usage limit exceeded');
    }

    const usage = await this.prisma.bundleUsage.create({
      data: {
        purchaseId: cmd.purchaseId,
        bookingId: cmd.bookingId ?? null,
        serviceId: cmd.serviceId,
        deliveryType: cmd.deliveryType ?? DeliveryType.IN_PERSON,
        quantityUsed: quantityToUse,
        notes: cmd.notes,
      },
    });

    // Mark purchase as COMPLETED if all usages consumed
    if (totalUsed + quantityToUse >= totalQuantity) {
      await this.prisma.bundlePurchase.update({
        where: { id: cmd.purchaseId },
        data: { status: BundlePurchaseStatus.COMPLETED },
      });
    }

    return usage;
  }
}
