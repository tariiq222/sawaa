import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

export interface ListClientBundlePurchasesQuery {
  clientId: string;
  status?: string;
}

@Injectable()
export class ListClientBundlePurchasesHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: ListClientBundlePurchasesQuery) {
    const where: Record<string, unknown> = { clientId: query.clientId };
    if (query.status) {
      where.status = query.status;
    }

    const purchases = await this.prisma.bundlePurchase.findMany({
      where,
      include: { usages: true },
      orderBy: { createdAt: 'desc' },
    });

    // Fetch all referenced bundles and services in bulk (cross-BC IDs are plain strings)
    const bundleIds = [...new Set(purchases.map((p) => p.bundleId))];
    const serviceIds = [...new Set(purchases.flatMap((p) => p.usages.map((u) => u.serviceId)))];

    const bundles = bundleIds.length
      ? await this.prisma.serviceBundle.findMany({
          where: { id: { in: bundleIds } },
          select: {
            id: true,
            nameAr: true,
            nameEn: true,
            discountType: true,
            discountValue: true,
            items: {
              include: {
                service: { select: { id: true, nameAr: true, nameEn: true } },
              },
            },
          },
        })
      : [];

    const services = serviceIds.length
      ? await this.prisma.service.findMany({
          where: { id: { in: serviceIds } },
          select: { id: true, nameAr: true, nameEn: true },
        })
      : [];

    const bundleMap = new Map(bundles.map((b) => [b.id, b]));
    const serviceMap = new Map(services.map((s) => [s.id, s]));

    return purchases.map((p) => {
      const bundle = bundleMap.get(p.bundleId);
      return {
        id: p.id,
        bundleId: p.bundleId,
        bundleName: bundle?.nameAr ?? '',
        amountPaid: Number(p.amountPaid),
        paidAt: p.paidAt,
        expiresAt: p.expiresAt,
        status: p.status,
        totalUsages: p.usages.length,
        usages: p.usages.map((u) => {
          const service = serviceMap.get(u.serviceId);
          return {
            id: u.id,
            serviceId: u.serviceId,
            serviceName: service?.nameAr ?? '',
            deliveryType: u.deliveryType,
            quantityUsed: u.quantityUsed,
            usedAt: u.usedAt,
            notes: u.notes,
          };
        }),
        createdAt: p.createdAt,
      };
    });
  }
}
