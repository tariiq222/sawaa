import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { BundlePurchaseStatus, Prisma } from '@prisma/client';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { BundlePriceService } from '../../org-experience/bundles/bundle-price.service';
import { computeVat, toHalalas } from '../money.helper';

export interface CreateBundlePurchaseCommand {
  bundleId: string;
  clientId: string;
  branchId: string;
  employeeId: string;
  paymentMethod: 'ONLINE_CARD' | 'BANK_TRANSFER' | 'CASH';
  notes?: string;
}

@Injectable()
export class CreateBundlePurchaseHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rlsTransaction: RlsTransactionService,
    private readonly bundlePriceService: BundlePriceService,
  ) {}

  async execute(cmd: CreateBundlePurchaseCommand) {
    const bundle = await this.prisma.serviceBundle.findFirst({
      where: { id: cmd.bundleId, archivedAt: null, isActive: true },
      include: {
        items: {
          include: { service: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
    if (!bundle) throw new NotFoundException('Bundle not found');

    const servicePrices = bundle.items.map((i) => Number(i.service.price));
    const { subtotal, finalPrice } = this.bundlePriceService.computeBundlePrice({
      servicePrices,
      discountType: bundle.discountType,
      discountValue: Number(bundle.discountValue),
    });

    const client = await this.prisma.client.findFirst({
      where: { id: cmd.clientId },
      select: { id: true },
    });
    if (!client) throw new NotFoundException('Client not found');

    const result = await this.rlsTransaction.withTransaction(async (tx) => {
      // Check for existing active purchase of same bundle
      const existing = await tx.bundlePurchase.findFirst({
        where: {
          bundleId: cmd.bundleId,
          clientId: cmd.clientId,
          status: BundlePurchaseStatus.ACTIVE,
        },
      });
      if (existing) {
        throw new BadRequestException('Client already has an active purchase of this bundle');
      }

      const purchase = await tx.bundlePurchase.create({
        data: {
          bundleId: cmd.bundleId,
          clientId: cmd.clientId,
          branchId: cmd.branchId,
          amountPaid: finalPrice,
          paidAt: new Date(),
          status: BundlePurchaseStatus.ACTIVE,
          notes: cmd.notes,
        },
      });

      const orgSettings = await tx.organizationSettings.findFirst({
        where: {},
        select: { vatRate: true },
      });
      const vatRateDec = new Prisma.Decimal(orgSettings?.vatRate?.toString() ?? '0');
      // All monetary arithmetic stays in Prisma.Decimal — no float intermediary
      const subtotalDec = toHalalas(subtotal);
      const finalPriceDec = toHalalas(finalPrice);
      const discountAmt = subtotalDec.minus(finalPriceDec);
      const { vatAmtHalalas, totalHalalas } = computeVat(finalPriceDec, vatRateDec);

      const invoice = await tx.invoice.create({
        data: {
          branchId: cmd.branchId,
          clientId: cmd.clientId,
          employeeId: cmd.employeeId,
          bundlePurchaseId: purchase.id,
          subtotal: subtotalDec,
          discountAmt,
          vatRate: vatRateDec,
          vatAmt: vatAmtHalalas,
          total: totalHalalas,
          currency: bundle.currency,
          status: 'ISSUED',
          issuedAt: new Date(),
        },
      });

      return { purchase, invoice };
    });

    return result;
  }
}
