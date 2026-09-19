import { BadRequestException } from '@nestjs/common';
import { DeliveryType, Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { PriceResolverService } from '../services/price-resolver.service';
import type { PackageGroupInput, PackageSessionInput } from '@sawaa/shared/types';
import { validateGroupGraph } from './package-group-policy';

type OfferingDb = PrismaService | Prisma.TransactionClient;

type ServiceOfferingRow = {
  id: string;
  nameAr: string;
  nameEn: string | null;
  isHidden: boolean;
  category: { id: string; isActive: boolean; bookingMode: string; nameAr?: string; nameEn?: string | null } | null;
};

type EmployeeOfferingRow = {
  id: string;
  name: string;
  nameAr: string | null;
  nameEn: string | null;
};

type EmployeeServiceOfferingRow = {
  id: string;
  employeeId: string;
  serviceId: string;
  isActive: boolean;
  disabledDeliveryTypes: DeliveryType[];
  useCustomPricing: boolean;
};

type DurationOfferingRow = {
  id: string;
  serviceId: string;
  employeeServiceId: string | null;
  deliveryType: DeliveryType;
  durationMins: number;
  price: unknown;
  isActive: boolean;
};

/** Decimal(12,2) is used for integer halalas throughout the package schema. */
export const MAX_PACKAGE_MONEY_HALALAS = 9_999_999_999;

export type PackageGroupInputLike = Omit<PackageGroupInput, 'dependsOnGroupKey' | 'label'> & {
  label?: string | null;
  dependsOnGroupKey?: string | null;
};

export interface ResolvedPackageGroupSession extends PackageSessionInput {
  durationMins: number;
  listPrice: number;
  effectivePrice: number;
  serviceName: string;
  employeeName: string;
}

export interface ResolvedPackageGroupOffering extends Omit<PackageGroupInput, 'sessions'> {
  sessions: ResolvedPackageGroupSession[];
}

const asMoney = (value: unknown): number => {
  const amount = typeof value === 'number' ? value : Number(String(value));
  if (!Number.isSafeInteger(amount) || amount < 0 || amount > MAX_PACKAGE_MONEY_HALALAS) {
    throw new BadRequestException('Package offering prices must be non-negative integer halalas');
  }
  return amount;
};

/**
 * Validate and resolve every concrete offering used by a grouped package.
 * All identity and ownership checks happen before PriceResolverService is
 * called, so an invalid explicit duration can never fall through to a base
 * service price.
 */
export async function resolvePackageGroupOfferings(
  db: OfferingDb,
  groups: readonly PackageGroupInputLike[],
  priceResolver?: PriceResolverService,
): Promise<ResolvedPackageGroupOffering[]> {
  const normalizedGroups: PackageGroupInput[] = groups.map((group) => ({
    ...group,
    label: group.label ?? undefined,
    dependsOnGroupKey: group.dependsOnGroupKey ?? null,
  }));
  validateGroupGraph(normalizedGroups);

  const serviceIds = [...new Set(normalizedGroups.map((group) => group.serviceId))];
  const employeeIds = [...new Set(normalizedGroups.map((group) => group.employeeId))];
  const durationIds = [...new Set(normalizedGroups.flatMap((group) => group.sessions.map((session) => session.durationOptionId)))];

  const [services, employees, links, durations] = await Promise.all([
    db.service.findMany({
      where: { id: { in: serviceIds }, isActive: true, archivedAt: null },
      select: {
        id: true,
        nameAr: true,
        nameEn: true,
        isHidden: true,
        category: { select: { id: true, isActive: true, bookingMode: true, nameAr: true, nameEn: true } },
      },
    }),
    db.employee.findMany({
      where: { id: { in: employeeIds }, isActive: true },
      select: { id: true, name: true, nameAr: true, nameEn: true },
    }),
    db.employeeService.findMany({
      where: {
        isActive: true,
        OR: normalizedGroups.map((group) => ({ employeeId: group.employeeId, serviceId: group.serviceId })),
      },
      select: {
        id: true,
        employeeId: true,
        serviceId: true,
        isActive: true,
        disabledDeliveryTypes: true,
        useCustomPricing: true,
      },
    }),
    db.serviceDurationOption.findMany({
      where: { id: { in: durationIds }, isActive: true },
      select: {
        id: true,
        serviceId: true,
        employeeServiceId: true,
        deliveryType: true,
        durationMins: true,
        price: true,
        isActive: true,
      },
    }),
  ]);

  const serviceById = new Map<string, ServiceOfferingRow>(
    services.map((service): [string, ServiceOfferingRow] => [service.id, service]),
  );
  const employeeById = new Map<string, EmployeeOfferingRow>(
    employees.map((employee): [string, EmployeeOfferingRow] => [employee.id, employee]),
  );
  const linkByPair = new Map<string, EmployeeServiceOfferingRow>(
    links.map((link): [string, EmployeeServiceOfferingRow] => [`${link.employeeId}:${link.serviceId}`, link]),
  );
  const durationById = new Map<string, DurationOfferingRow>(
    durations.map((duration): [string, DurationOfferingRow] => [duration.id, duration]),
  );

  const bookingConfigs = await db.serviceBookingConfig.findMany({
    where: { serviceId: { in: serviceIds }, isActive: true },
    select: { serviceId: true, deliveryType: true },
  });
  const allowedByService = new Map<string, Set<DeliveryType>>();
  for (const config of bookingConfigs) {
    const allowed = allowedByService.get(config.serviceId) ?? new Set<DeliveryType>();
    allowed.add(config.deliveryType);
    allowedByService.set(config.serviceId, allowed);
  }

  // Identity checks deliberately happen for every group before any resolver
  // fallback. This also gives the editor one consistent error surface.
  for (const group of normalizedGroups) {
    const service = serviceById.get(group.serviceId);
    if (!service) throw new BadRequestException(`Service not found or inactive: ${group.serviceId}`);
    if (service.category && service.category.isActive === false) {
      throw new BadRequestException(`Service category is inactive: ${group.serviceId}`);
    }
    if (service.isHidden && service.category?.bookingMode !== 'DIRECT') {
      throw new BadRequestException('Hidden services must belong to a DIRECT category');
    }

    if (!employeeById.has(group.employeeId)) {
      throw new BadRequestException(`Employee not found or inactive: ${group.employeeId}`);
    }
    const link = linkByPair.get(`${group.employeeId}:${group.serviceId}`);
    if (!link) throw new BadRequestException('Employee does not provide this service');

    for (const session of group.sessions) {
      if (!Number.isSafeInteger(session.unitPrice) || session.unitPrice < 0) {
        throw new BadRequestException('Package session unitPrice must be a non-negative integer halala amount');
      }
      const duration = durationById.get(session.durationOptionId);
      if (!duration) {
        throw new BadRequestException(`Duration option not found or inactive: ${session.durationOptionId}`);
      }
      if (duration.serviceId !== group.serviceId) {
        throw new BadRequestException('Duration option does not belong to the selected service');
      }
      const expectedOwner = link.useCustomPricing ? link.id : null;
      if (duration.employeeServiceId !== expectedOwner) {
        throw new BadRequestException('Selected duration option is not offered by this practitioner');
      }
      if (duration.deliveryType !== session.deliveryType) {
        throw new BadRequestException(
          `Duration option delivery type (${duration.deliveryType}) does not match requested delivery type (${session.deliveryType})`,
        );
      }
      if ((link.disabledDeliveryTypes ?? []).includes(session.deliveryType)) {
        throw new BadRequestException('Practitioner does not offer this delivery type');
      }
      const allowed = allowedByService.get(group.serviceId);
      if (allowed && !allowed.has(session.deliveryType)) {
        throw new BadRequestException(`Service does not support ${session.deliveryType} delivery type`);
      }
      // A mismatched override is ignored by the resolver; the explicit target
      // itself has already passed ownership and delivery validation above.
    }
  }

  const resolver = priceResolver ?? new PriceResolverService(db as PrismaService);
  return resolveResolvedGroups(normalizedGroups, serviceById, employeeById, linkByPair, resolver);
}

export function validateGroupedPackageStorageBounds(
  unitPrices: readonly number[],
  discount: { type: string; value: number },
): void {
  let subtotal = 0;
  for (const price of unitPrices) {
    if (!Number.isSafeInteger(price) || price < 0 || price > MAX_PACKAGE_MONEY_HALALAS) {
      throw new BadRequestException('Package session unitPrice exceeds the Decimal(12,2) storage limit');
    }
    subtotal += price;
    if (subtotal > MAX_PACKAGE_MONEY_HALALAS) {
      throw new BadRequestException('Package session subtotal exceeds the Decimal(12,2) storage limit');
    }
  }
  if (discount.type === 'FIXED' && (!Number.isSafeInteger(discount.value) || discount.value < 0 || discount.value > MAX_PACKAGE_MONEY_HALALAS)) {
    throw new BadRequestException('Fixed package discount exceeds the Decimal(12,2) storage limit');
  }
  if (discount.type === 'PERCENTAGE' && (!Number.isFinite(discount.value) || new Prisma.Decimal(discount.value).decimalPlaces() > 2)) {
    throw new BadRequestException('Percentage package discount must have at most two decimal places');
  }
}

async function resolveResolvedGroups(
  groups: readonly PackageGroupInput[],
  serviceById: Map<string, ServiceOfferingRow>,
  employeeById: Map<string, EmployeeOfferingRow>,
  linkByPair: Map<string, EmployeeServiceOfferingRow>,
  resolver: PriceResolverService,
): Promise<ResolvedPackageGroupOffering[]> {
  return Promise.all(groups.map(async (group) => {
    const service = serviceById.get(group.serviceId);
    const employee = employeeById.get(group.employeeId);
    const link = linkByPair.get(`${group.employeeId}:${group.serviceId}`);
    if (!service || !employee || !link) {
      throw new BadRequestException(`Grouped package offering is no longer available: ${group.key}`);
    }
    const sessions = await Promise.all(group.sessions.map(async (session) => {
      const resolved = await resolver.resolve({
        serviceId: group.serviceId,
        employeeServiceId: link.id,
        durationOptionId: session.durationOptionId,
        deliveryType: session.deliveryType,
        useCustomPricing: link.useCustomPricing,
      });
      return {
        ...session,
        durationMins: resolved.durationMins,
        listPrice: asMoney(resolved.price),
        effectivePrice: asMoney(resolved.price),
        serviceName: (service.isHidden && service.category?.bookingMode === 'DIRECT'
          ? service.category.nameAr || service.category.nameEn
          : null) || service.nameAr || service.nameEn || '',
        employeeName: employee.nameAr ?? employee.nameEn ?? employee.name,
      };
    }));
    return { ...group, sessions };
  }));
}
