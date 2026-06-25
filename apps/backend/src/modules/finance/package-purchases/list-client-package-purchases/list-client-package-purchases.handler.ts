import { Injectable } from '@nestjs/common';
import { PackagePurchaseStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/database';

export interface ListClientPackagePurchasesQuery {
  clientId: string;
  status?: PackagePurchaseStatus;
}

export interface ClientPackageCreditRow {
  id: string;
  serviceId: string;
  employeeId: string;
  durationOptionId: string;
  serviceNameAr: string;
  serviceNameEn: string | null;
  employeeNameAr: string;
  employeeNameEn: string | null;
  durationLabelAr: string;
  durationLabelEn: string | null;
  durationMins: number | null;
  /** Integer halalas (1 SAR = 100). */
  unitPriceSnapshot: number;
  totalQuantity: number;
  usedQuantity: number;
  /** Computed: totalQuantity − usedQuantity. */
  remaining: number;
}

export interface ClientPackagePurchaseRow {
  id: string;
  packageId: string;
  packageNameAr: string;
  packageNameEn: string | null;
  status: PackagePurchaseStatus;
  /** Integer halalas (1 SAR = 100). */
  subtotalSnapshot: number;
  /** Integer halalas (1 SAR = 100). */
  discountSnapshot: number;
  /** Integer halalas (1 SAR = 100). */
  amountPaid: number;
  /** Integer halalas (1 SAR = 100). */
  refundAmount: number;
  paidAt: string;
  refundedAt: string | null;
  notes: string | null;
  createdAt: string;
  credits: ClientPackageCreditRow[];
}

/**
 * List every package purchase a given client has made (newest paid first),
 * with each purchase's credits enriched with resolved service / employee /
 * duration display names. `remaining = totalQuantity − usedQuantity` is
 * pre-computed so the dashboard's "credit balance" widget does not have to
 * do arithmetic on the client.
 */
@Injectable()
export class ListClientPackagePurchasesHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: ListClientPackagePurchasesQuery): Promise<ClientPackagePurchaseRow[]> {
    const where: Prisma.PackagePurchaseWhereInput = { clientId: query.clientId };
    if (query.status) {
      where.status = query.status;
    }

    const purchases = await this.prisma.packagePurchase.findMany({
      where,
      include: { credits: true },
      orderBy: { paidAt: 'desc' },
    });

    if (purchases.length === 0) {
      return [];
    }

    // Bulk-resolve every display name referenced by the credits + purchases
    // (cross-BC IDs are plain strings — no Prisma join). Four lookups instead
    // of one-per-row keeps the round-trips constant.
    const packageIds = [...new Set(purchases.map((p) => p.packageId))];
    const serviceIds = [...new Set(purchases.flatMap((p) => p.credits.map((c) => c.serviceId)))];
    const employeeIds = [...new Set(purchases.flatMap((p) => p.credits.map((c) => c.employeeId)))];
    const durationOptionIds = [...new Set(purchases.flatMap((p) => p.credits.map((c) => c.durationOptionId)))];

    const [packages, services, employees, durationOptions] = await Promise.all([
      packageIds.length > 0
        ? this.prisma.sessionPackage.findMany({
            where: { id: { in: packageIds } },
            select: { id: true, nameAr: true, nameEn: true },
          })
        : Promise.resolve([]),
      serviceIds.length > 0
        ? this.prisma.service.findMany({
            where: { id: { in: serviceIds } },
            select: { id: true, nameAr: true, nameEn: true },
          })
        : Promise.resolve([]),
      employeeIds.length > 0
        ? this.prisma.employee.findMany({
            where: { id: { in: employeeIds } },
            // `name` is the canonical fallback (every Employee row has one);
            // nameAr / nameEn are the localised fields when populated.
            select: { id: true, name: true, nameAr: true, nameEn: true },
          })
        : Promise.resolve([]),
      durationOptionIds.length > 0
        ? this.prisma.serviceDurationOption.findMany({
            where: { id: { in: durationOptionIds } },
            // labelAr is the customer-facing Arabic label; label is the canonical
            // (English / internal) label. The model has no labelEn column.
            select: { id: true, labelAr: true, label: true, durationMins: true },
          })
        : Promise.resolve([]),
    ]);

    const packageMap = new Map(packages.map((p) => [p.id, p]));
    const serviceMap = new Map(services.map((s) => [s.id, s]));
    const employeeMap = new Map(employees.map((e) => [e.id, e]));
    const durationMap = new Map(durationOptions.map((d) => [d.id, d]));

    return purchases.map((purchase) => {
      const pkg = packageMap.get(purchase.packageId);
      return {
        id: purchase.id,
        packageId: purchase.packageId,
        packageNameAr: pkg?.nameAr ?? '',
        packageNameEn: pkg?.nameEn ?? null,
        status: purchase.status,
        subtotalSnapshot: Number(purchase.subtotalSnapshot),
        discountSnapshot: Number(purchase.discountSnapshot),
        amountPaid: Number(purchase.amountPaid),
        refundAmount: Number(purchase.refundAmount),
        paidAt: purchase.paidAt.toISOString(),
        refundedAt: purchase.refundedAt?.toISOString() ?? null,
        notes: purchase.notes,
        createdAt: purchase.createdAt.toISOString(),
        credits: purchase.credits.map((credit) => {
          const service = serviceMap.get(credit.serviceId);
          const employee = employeeMap.get(credit.employeeId);
          const duration = durationMap.get(credit.durationOptionId);
          return {
            id: credit.id,
            serviceId: credit.serviceId,
            employeeId: credit.employeeId,
            durationOptionId: credit.durationOptionId,
            serviceNameAr: service?.nameAr ?? '',
            serviceNameEn: service?.nameEn ?? null,
            employeeNameAr: employee?.nameAr ?? employee?.name ?? '',
            employeeNameEn: employee?.nameEn ?? null,
            durationLabelAr: duration?.labelAr ?? '',
            // The duration model has no labelEn — fall back to label (English).
            durationLabelEn: duration?.label ?? null,
            durationMins: duration?.durationMins ?? null,
            unitPriceSnapshot: Number(credit.unitPriceSnapshot),
            totalQuantity: credit.totalQuantity,
            usedQuantity: credit.usedQuantity,
            remaining: credit.totalQuantity - credit.usedQuantity,
          };
        }),
      };
    });
  }
}