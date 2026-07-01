import { Injectable } from '@nestjs/common';
import { PackagePurchaseStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/database';

export interface ListClientPackagePurchasesQuery {
  clientId: string;
  status?: PackagePurchaseStatus;
}

export interface ClientPackageCreditRow {
  id: string;
  // null on flexible (rule-based) credits, which are not pinned to one triple.
  serviceId: string | null;
  employeeId: string | null;
  durationOptionId: string | null;
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
  categoryId: string | null;
  categoryNameAr: string;
  categoryNameEn: string | null;
  categoryBookingMode: 'DIRECT' | 'SERVICES' | null;
  departmentId: string | null;
  departmentNameAr: string;
  departmentNameEn: string | null;
  /** True when the service is active, not archived, and the employee is active. */
  serviceIsBookable: boolean;
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
    const notNull = (x: string | null): x is string => x != null;
    const packageIds = [...new Set(purchases.map((p) => p.packageId))];
    const serviceIds = [...new Set(purchases.flatMap((p) => p.credits.map((c) => c.serviceId)).filter(notNull))];
    const employeeIds = [...new Set(purchases.flatMap((p) => p.credits.map((c) => c.employeeId)).filter(notNull))];
    const durationOptionIds = [...new Set(purchases.flatMap((p) => p.credits.map((c) => c.durationOptionId)).filter(notNull))];

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
            select: {
              id: true, nameAr: true, nameEn: true, isActive: true, archivedAt: true,
              categoryId: true,
              category: {
                select: {
                  id: true, nameAr: true, nameEn: true, bookingMode: true, departmentId: true,
                  department: { select: { id: true, nameAr: true, nameEn: true } },
                },
              },
            },
          })
        : Promise.resolve([]),
      employeeIds.length > 0
        ? this.prisma.employee.findMany({
            where: { id: { in: employeeIds } },
            // `name` is the canonical fallback (every Employee row has one);
            // nameAr / nameEn are the localised fields when populated.
            select: { id: true, name: true, nameAr: true, nameEn: true, isActive: true },
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

    // P1-8: a credit is only bookable if the employee STILL provides the
    // service via an active EmployeeService link — the wizard must not show a
    // credit as bookable that book-from-credit will reject. Bulk-resolve the
    // active links for every (employeeId, serviceId) pair the credits touch.
    const activeLinks =
      employeeIds.length > 0 && serviceIds.length > 0
        ? await this.prisma.employeeService.findMany({
            where: {
              employeeId: { in: employeeIds },
              serviceId: { in: serviceIds },
              isActive: true,
            },
            select: { employeeId: true, serviceId: true },
          })
        : [];
    const activeLinkSet = new Set(
      activeLinks.map((l) => `${l.employeeId}:${l.serviceId}`),
    );

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
          const service = credit.serviceId ? serviceMap.get(credit.serviceId) : undefined;
          const employee = credit.employeeId ? employeeMap.get(credit.employeeId) : undefined;
          const duration = credit.durationOptionId ? durationMap.get(credit.durationOptionId) : undefined;
          const category = service?.category ?? null;
          const department = category?.department ?? null;
          const serviceIsBookable =
            !!service &&
            service.isActive &&
            service.archivedAt === null &&
            !!employee &&
            employee.isActive &&
            activeLinkSet.has(`${credit.employeeId}:${credit.serviceId}`);
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
            categoryId: service?.categoryId ?? null,
            categoryNameAr: category?.nameAr ?? '',
            categoryNameEn: category?.nameEn ?? null,
            categoryBookingMode: (category?.bookingMode as 'DIRECT' | 'SERVICES' | undefined) ?? null,
            departmentId: department?.id ?? null,
            departmentNameAr: department?.nameAr ?? '',
            departmentNameEn: department?.nameEn ?? null,
            serviceIsBookable,
          };
        }),
      };
    });
  }
}