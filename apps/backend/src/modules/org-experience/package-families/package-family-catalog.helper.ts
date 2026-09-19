import { applyGroupedPackagePrice, decorateGroupedPackage } from '../session-packages/package-group-catalog.helper';
import { familySessionCount } from './package-family-write.helper';
import { signMediaImageUrl } from '../../media/media-image-url.helper';
import type { ComputePackagePriceService } from '../compute-package-price.service';
import type { PrismaService } from '../../../infrastructure/database';

const zeroPrice = { subtotal: 0, discountAmount: 0, finalPrice: 0, fullValue: 0, freeValue: 0, itemUnitPrices: [], lines: [] };

type DisplaySource = { options?: readonly unknown[] } | { id?: string; groups?: readonly unknown[]; items?: readonly unknown[] };
type DisplayService = { id: string; nameAr: string; nameEn: string | null; isHidden: boolean; category: { nameAr: string; nameEn: string | null; bookingMode: string } | null };
type DisplayEmployee = { id: string; name: string; nameAr: string | null; nameEn: string | null };
type DisplayDuration = { id: string; durationMins: number; deliveryType: 'IN_PERSON' | 'ONLINE' };
type DisplayGroupSession = { position: number; durationMins: number; deliveryType: 'IN_PERSON' | 'ONLINE' };
type DisplayGroup = { key: string; label: string | null; serviceNameAr: string; serviceNameEn: string | null; employeeName: string; sessions: DisplayGroupSession[] };

export interface FamilyDisplayData {
  services: Map<string, DisplayService>;
  employees: Map<string, DisplayEmployee>;
  durations: Map<string, DisplayDuration>;
}

type FamilyDisplayDb = Pick<PrismaService, 'service' | 'employee' | 'serviceDurationOption'>;

function sourceOptions(sources: readonly DisplaySource[]): Array<Record<string, unknown>> {
  return sources.flatMap((source) => {
    const candidate = source as { options?: readonly Record<string, unknown>[]; groups?: readonly unknown[] };
    return candidate.options ? [...candidate.options] : [candidate as Record<string, unknown>];
  });
}

/** Resolve all current display labels for a family read in three bulk queries. */
export async function loadFamilyDisplayData(db: FamilyDisplayDb, sources: readonly DisplaySource[]): Promise<FamilyDisplayData> {
  const options = sourceOptions(sources);
  const groups = options.flatMap((option) => Array.isArray(option.groups) ? option.groups as Array<Record<string, unknown>> : []);
  const items = [
    ...options.flatMap((option) => Array.isArray(option.items) ? option.items as Array<Record<string, unknown>> : []),
    ...groups.flatMap((group) => Array.isArray(group.items) ? group.items as Array<Record<string, unknown>> : []),
  ];
  const serviceIds = [...new Set(groups.map((group) => String(group.serviceId ?? '')).filter(Boolean))];
  const employeeIds = [...new Set(groups.map((group) => String(group.employeeId ?? '')).filter(Boolean))];
  const durationIds = [...new Set(items.map((item) => String(item.durationOptionId ?? '')).filter(Boolean))];

  if (!db.service?.findMany || !db.employee?.findMany || !db.serviceDurationOption?.findMany) {
    return { services: new Map(), employees: new Map(), durations: new Map() };
  }
  const [services, employees, durations] = await Promise.all([
    serviceIds.length ? db.service.findMany({ where: { id: { in: serviceIds } }, select: { id: true, nameAr: true, nameEn: true, isHidden: true, category: { select: { nameAr: true, nameEn: true, bookingMode: true } } } }) : [],
    employeeIds.length ? db.employee.findMany({ where: { id: { in: employeeIds } }, select: { id: true, name: true, nameAr: true, nameEn: true } }) : [],
    durationIds.length ? db.serviceDurationOption.findMany({ where: { id: { in: durationIds } }, select: { id: true, durationMins: true, deliveryType: true } }) : [],
  ]);
  return {
    services: new Map(services.map((service) => [service.id, service as DisplayService])),
    employees: new Map(employees.map((employee) => [employee.id, employee as DisplayEmployee])),
    durations: new Map(durations.map((duration) => [duration.id, duration as DisplayDuration])),
  };
}

function displayGroupsForOption(option: any, display?: FamilyDisplayData): DisplayGroup[] | undefined {
  if (!display || option.modelVersion !== 'GROUPED_V2') return undefined;
  const decorated = decorateGroupedPackage(option);
  if (!decorated.groups.length) return undefined;
  const groups = decorated.groups.map((group) => {
    const service = display.services.get(group.serviceId);
    const employee = display.employees.get(group.employeeId);
    if (!service || !employee) return null;
    const directClinic = service.isHidden && service.category?.bookingMode === 'DIRECT';
    const serviceNameAr = (directClinic ? service.category?.nameAr : service.nameAr) || service.nameAr || service.nameEn || '';
    const serviceNameEn = (directClinic ? service.category?.nameEn : service.nameEn) ?? service.nameEn ?? null;
    const sessions = group.sessions.map<DisplayGroupSession | null>((session) => {
      const duration = display.durations.get(session.durationOptionId);
      if (!duration) return null;
      return { position: session.position, durationMins: duration.durationMins, deliveryType: session.deliveryType };
    });
    if (sessions.some((session): session is null => session === null)) return null;
    return {
      key: group.key,
      label: group.label ?? null,
      serviceNameAr,
      serviceNameEn,
      employeeName: employee.nameAr ?? employee.nameEn ?? employee.name,
      sessions: sessions as DisplayGroupSession[],
    };
  });
  return groups.every((group): group is DisplayGroup => group !== null) ? groups : undefined;
}

export async function decorateFamilyOption(option: any, pricing?: Pick<ComputePackagePriceService, 'compute'>, storage?: any, bucket?: string, display?: FamilyDisplayData) {
  const decorated = decorateGroupedPackage(option);
  const displayGroups = displayGroupsForOption(option, display);
  const legacyPrice = pricing?.compute
    ? await pricing.compute({ items: (option.items ?? []).map((item: any) => ({
      serviceId: item.serviceId,
      employeeId: item.employeeId,
      durationOptionId: item.durationOptionId,
      unitPrice: item.unitPrice == null ? null : Number(item.unitPrice),
      paidQuantity: item.paidQuantity ?? 1,
      freeQuantity: item.freeQuantity ?? 0,
      discountType: item.discountType,
      discountValue: Number(item.discountValue ?? 0),
    })) }, { strict: false })
    : zeroPrice;
  const price = applyGroupedPackagePrice(option, legacyPrice);
  return {
    id: option.id,
    familyId: option.familyId ?? null,
    nameAr: option.nameAr,
    nameEn: option.nameEn ?? null,
    descriptionAr: option.descriptionAr ?? null,
    descriptionEn: option.descriptionEn ?? null,
    imageUrl: storage && bucket ? await signMediaImageUrl(storage, bucket, option.imageUrl) : option.imageUrl ?? null,
    isActive: option.isActive,
    isPublic: option.isPublic,
    sortOrder: option.sortOrder ?? 0,
    modelVersion: option.modelVersion,
    groups: decorated.groups,
    globalDiscount: decorated.globalDiscount,
    ...(displayGroups ? { displayGroups } : {}),
    sessionCount: familySessionCount(option),
    price,
  };
}

export async function decorateFamily(family: any, pricing?: Pick<ComputePackagePriceService, 'compute'>, storage?: any, bucket?: string, isStandalone = false, display?: FamilyDisplayData) {
  const options = await Promise.all((family.options ?? []).map((option: any) => decorateFamilyOption(option, pricing, storage, bucket, display)));
  return {
    id: family.id,
    nameAr: family.nameAr,
    nameEn: family.nameEn ?? null,
    descriptionAr: family.descriptionAr ?? null,
    descriptionEn: family.descriptionEn ?? null,
    imageUrl: storage && bucket ? await signMediaImageUrl(storage, bucket, family.imageUrl) : family.imageUrl ?? null,
    isActive: family.isActive,
    isPublic: family.isPublic,
    sortOrder: family.sortOrder ?? 0,
    archivedAt: family.archivedAt ?? null,
    createdAt: family.createdAt,
    updatedAt: family.updatedAt,
    isStandalone,
    options,
  };
}
