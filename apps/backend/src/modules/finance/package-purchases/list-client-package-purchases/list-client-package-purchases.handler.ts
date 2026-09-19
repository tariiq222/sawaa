import { Injectable } from '@nestjs/common';
import { PackagePurchaseStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/database';
import { validateBookingTargetEligibility } from '../../../bookings/booking-target-eligibility.helper';
import { getPackageCreditAvailability } from '../../../bookings/package-credit-availability.helper';
import { parsePackageOfferSnapshot } from '../package-offer-snapshot';

export interface ListClientPackagePurchasesQuery {
  clientId: string;
  status?: PackagePurchaseStatus;
}

export interface ClientPackageCreditConstraintRow {
  dimension: 'SERVICE' | 'PRACTITIONER' | 'DURATION' | 'DELIVERY_TYPE';
  mode: 'ANY' | 'INCLUDE' | 'EXCLUDE';
  /** Flattened from the constraint's `targets[].targetId` rows. Empty for ANY. */
  targetIds: string[];
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
  // Booked but not-yet-delivered sessions; they occupy a seat like a used one.
  reservedQuantity: number;
  /** Computed: totalQuantity − usedQuantity − reservedQuantity. */
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
  /**
   * Snapshot eligibility rules for this credit. Empty array means the credit
   * predates constraint snapshotting — consumers must then fall back to the
   * legacy (serviceId, employeeId, durationOptionId) triple as INCLUDE rules,
   * mirroring `effectiveConstraints` in
   * modules/bookings/package-credit-matching.helper.ts.
   */
  constraints: ClientPackageCreditConstraintRow[];
  purchaseGroupId: string | null;
  sessionPosition: number | null;
  groupLabel: string | null;
  sequenceMode: 'ORDERED' | 'UNORDERED' | null;
  dependsOnGroupId: string | null;
  durationMinsSnapshot: number | null;
  deliveryTypeSnapshot: string | null;
  serviceNameSnapshot: string | null;
  employeeNameSnapshot: string | null;
  listPriceSnapshot: number | null;
  netValue: number | null;
  availability: { bookable: boolean; reason: string | null };
}

export interface ClientPackagePurchaseRow {
  id: string;
  packageId: string;
  packageNameAr: string;
  packageNameEn: string | null;
  /** Immutable family/option identity captured when the purchase was made. */
  offerSnapshot: ReturnType<typeof parsePackageOfferSnapshot>;
  familyId: string | null;
  familyNameAr: string | null;
  familyNameEn: string | null;
  optionNameAr: string | null;
  optionNameEn: string | null;
  sessionCount: number | null;
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
  modelVersion: 'LEGACY' | 'GROUPED_V2';
}

/**
 * List every package purchase a given client has made (newest paid first),
 * with each purchase's credits enriched with resolved service / employee /
 * duration display names. `remaining = totalQuantity − usedQuantity −
 * reservedQuantity` is pre-computed so the dashboard's "credit balance"
 * widget does not have to do arithmetic on the client — a reserved session
 * belongs to a booked-but-not-yet-delivered appointment and is not available
 * to offer again.
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
      include: {
          credits: {
            include: {
            constraints: {
              select: {
                dimension: true,
                mode: true,
                targets: { select: { targetId: true } },
              },
            },
            purchaseGroup: {
              select: {
                id: true,
                label: true,
                sequenceMode: true,
                dependsOnGroupId: true,
                credits: {
                  select: {
                    id: true,
                    sessionPosition: true,
                    totalQuantity: true,
                    usedQuantity: true,
                    reservedQuantity: true,
                    usages: { select: { status: true, deliveredAt: true } },
                  },
                },
                dependsOnGroup: {
                  select: {
                    credits: {
                      select: {
                        id: true,
                        sessionPosition: true,
                        totalQuantity: true,
                        usedQuantity: true,
                        reservedQuantity: true,
                        usages: { select: { status: true, deliveredAt: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
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
              isHidden: true,
              categoryId: true,
              category: {
                select: {
                  id: true, nameAr: true, nameEn: true, bookingMode: true, isActive: true, departmentId: true,
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

    // Keep the legacy serviceIsBookable projection unchanged. Grouped V2
    // availability also needs the current effective duration/delivery offering
    // because a practitioner can disable a channel, remove an option, or add a
    // duration override after the sale. Cache repeated targets across session
    // positions so this does not become one eligibility lookup per credit.
    const v2OfferingAvailability = new Map<string, boolean>();
    const v2Targets = new Map<string, {
      serviceId: string;
      employeeId: string;
      durationOptionId: string;
      deliveryType: string;
      durationMinsSnapshot: number | null;
    }>();
    for (const purchase of purchases) {
      if (purchase.modelVersion !== 'GROUPED_V2') continue;
      for (const credit of purchase.credits) {
        if (
          !credit.serviceId || !credit.employeeId || !credit.durationOptionId ||
          !credit.deliveryTypeSnapshot
        ) continue;
        const key = [
          credit.serviceId,
          credit.employeeId,
          credit.durationOptionId,
          credit.deliveryTypeSnapshot,
          credit.durationMinsSnapshot ?? 'missing',
        ].join(':');
        v2Targets.set(key, {
          serviceId: credit.serviceId,
          employeeId: credit.employeeId,
          durationOptionId: credit.durationOptionId,
          deliveryType: credit.deliveryTypeSnapshot,
          durationMinsSnapshot: credit.durationMinsSnapshot,
        });
      }
    }
    await Promise.all([...v2Targets.entries()].map(async ([key, target]) => {
      const service = serviceMap.get(target.serviceId);
      const employee = employeeMap.get(target.employeeId);
      if (
        !service || service.isActive !== true || service.archivedAt !== null ||
        service.category?.isActive === false || !employee || employee.isActive !== true ||
        !activeLinkSet.has(`${target.employeeId}:${target.serviceId}`) ||
        target.durationMinsSnapshot == null
      ) {
        v2OfferingAvailability.set(key, false);
        return;
      }
      try {
        const eligibility = await validateBookingTargetEligibility(this.prisma, {
          serviceId: target.serviceId,
          employeeId: target.employeeId,
          durationOptionId: target.durationOptionId,
          deliveryType: target.deliveryType,
          bookingType: 'INDIVIDUAL',
        });
        v2OfferingAvailability.set(
          key,
          eligibility.durationOption?.durationMins === target.durationMinsSnapshot &&
            eligibility.deliveryType === target.deliveryType,
        );
      } catch {
        v2OfferingAvailability.set(key, false);
      }
    }));

    return purchases.map((purchase) => {
      const pkg = packageMap.get(purchase.packageId);
      const offerSnapshot = parsePackageOfferSnapshot(purchase.offerSnapshot);
      return {
        id: purchase.id,
        packageId: purchase.packageId,
        packageNameAr: offerSnapshot?.familyNameAr ?? pkg?.nameAr ?? '',
        packageNameEn: offerSnapshot?.familyNameEn ?? pkg?.nameEn ?? null,
        offerSnapshot,
        familyId: offerSnapshot?.familyId ?? null,
        familyNameAr: offerSnapshot?.familyNameAr ?? null,
        familyNameEn: offerSnapshot?.familyNameEn ?? null,
        optionNameAr: offerSnapshot?.optionNameAr ?? null,
        optionNameEn: offerSnapshot?.optionNameEn ?? null,
        sessionCount: offerSnapshot?.sessionCount ?? null,
        status: purchase.status,
        subtotalSnapshot: Number(purchase.subtotalSnapshot),
        discountSnapshot: Number(purchase.discountSnapshot),
        amountPaid: Number(purchase.amountPaid),
        refundAmount: Number(purchase.refundAmount),
        paidAt: purchase.paidAt.toISOString(),
        refundedAt: purchase.refundedAt?.toISOString() ?? null,
        notes: purchase.notes,
        createdAt: purchase.createdAt.toISOString(),
        modelVersion: purchase.modelVersion === 'GROUPED_V2' ? 'GROUPED_V2' : 'LEGACY',
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
          const group = credit.purchaseGroup;
          const v2TargetKey =
            credit.serviceId && credit.employeeId && credit.durationOptionId && credit.deliveryTypeSnapshot
              ? [
                credit.serviceId,
                credit.employeeId,
                credit.durationOptionId,
                credit.deliveryTypeSnapshot,
                credit.durationMinsSnapshot ?? 'missing',
              ].join(':')
              : null;
          const availability = getPackageCreditAvailability({
            modelVersion: purchase.modelVersion,
            purchaseStatus: purchase.status,
            totalQuantity: credit.totalQuantity,
            usedQuantity: credit.usedQuantity,
            reservedQuantity: credit.reservedQuantity,
            offeringAvailable: purchase.modelVersion === 'GROUPED_V2'
              ? v2TargetKey != null && v2OfferingAvailability.get(v2TargetKey) === true
              : serviceIsBookable,
            sequenceMode: group?.sequenceMode,
            sessionPosition: credit.sessionPosition,
            creditId: credit.id,
            purchaseGroupId: group?.id,
            usages: group?.credits.find((groupCredit) => groupCredit.id === credit.id)?.usages,
            dependsOnGroupId: group?.dependsOnGroupId,
            dependencyCredits: group?.dependsOnGroup?.credits,
            groupCredits: group?.credits,
          });
          // A direct-booking clinic books through one hidden internal service;
          // the clinic is the name staff and clients recognise.
          const namedByClinic =
            !!service?.isHidden && category?.bookingMode === 'DIRECT';
          return {
            id: credit.id,
            serviceId: credit.serviceId,
            employeeId: credit.employeeId,
            durationOptionId: credit.durationOptionId,
            serviceNameAr: (namedByClinic ? category?.nameAr : service?.nameAr) ?? '',
            serviceNameEn: (namedByClinic ? category?.nameEn : service?.nameEn) ?? null,
            employeeNameAr: employee?.nameAr ?? employee?.name ?? '',
            employeeNameEn: employee?.nameEn ?? null,
            durationLabelAr: duration?.labelAr ?? '',
            // The duration model has no labelEn — fall back to label (English).
            durationLabelEn: duration?.label ?? null,
            durationMins: duration?.durationMins ?? null,
            durationMinsSnapshot: credit.durationMinsSnapshot ?? null,
            deliveryTypeSnapshot: credit.deliveryTypeSnapshot ?? null,
            serviceNameSnapshot: credit.serviceNameSnapshot ?? null,
            employeeNameSnapshot: credit.employeeNameSnapshot ?? null,
            listPriceSnapshot: credit.listPriceSnapshot == null ? null : Number(credit.listPriceSnapshot),
            netValue: credit.netValue == null ? null : Number(credit.netValue),
            unitPriceSnapshot: Number(credit.unitPriceSnapshot),
            totalQuantity: credit.totalQuantity,
            usedQuantity: credit.usedQuantity,
            reservedQuantity: credit.reservedQuantity,
            remaining: credit.totalQuantity - credit.usedQuantity - credit.reservedQuantity,
            categoryId: service?.categoryId ?? null,
            categoryNameAr: category?.nameAr ?? '',
            categoryNameEn: category?.nameEn ?? null,
            categoryBookingMode: (category?.bookingMode as 'DIRECT' | 'SERVICES' | undefined) ?? null,
            departmentId: department?.id ?? null,
            departmentNameAr: department?.nameAr ?? '',
            departmentNameEn: department?.nameEn ?? null,
            serviceIsBookable,
            constraints: credit.constraints.map((c) => ({
              dimension: c.dimension as ClientPackageCreditConstraintRow['dimension'],
              mode: c.mode as ClientPackageCreditConstraintRow['mode'],
              targetIds: c.targets.map((t) => t.targetId),
            })),
            purchaseGroupId: credit.purchaseGroupId ?? null,
            sessionPosition: credit.sessionPosition ?? null,
            groupLabel: group?.label ?? null,
            sequenceMode: group?.sequenceMode ?? null,
            dependsOnGroupId: group?.dependsOnGroupId ?? null,
            availability,
          };
        }),
      };
    });
  }
}
