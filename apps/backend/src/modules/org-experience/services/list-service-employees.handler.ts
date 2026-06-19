import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { resolveEffectiveDurations } from './set-employee-durations/set-employee-durations.handler';

export interface ListServiceEmployeesQuery {
  serviceId: string;
}

/**
 * Returns the active employees who offer the given service, shaped to match the
 * dashboard's `ServiceEmployee` contract (EmployeeService row + nested employee + serviceTypes).
 * Each employee's serviceTypes reflects their per-employee price/duration overrides when set.
 */
@Injectable()
export class ListServiceEmployeesHandler {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async execute(query: ListServiceEmployeesQuery) {
    const service = await this.prisma.service.findFirst({ where: { id: query.serviceId } });
    if (!service) throw new NotFoundException('Service not found');

    const links = await this.prisma.employeeService.findMany({
      where: { serviceId: query.serviceId },
    });
    if (links.length === 0) return [];

    const linkIds = links.map((l) => l.id);

    const [employees, configs, allOptions, allDurationOptions] = await Promise.all([
      this.prisma.employee.findMany({
        where: { id: { in: links.map((l) => l.employeeId) }, isActive: true },
        orderBy: { name: 'asc' },
        include: { branches: true },
      }),
      this.prisma.serviceBookingConfig.findMany({
        where: { serviceId: query.serviceId, isActive: true },
        orderBy: { deliveryType: 'asc' },
      }),
      this.prisma.employeeServiceOption.findMany({
        where: { employeeServiceId: { in: linkIds }, isActive: true },
        include: { durationOption: true },
      }),
      this.prisma.serviceDurationOption.findMany({
        where: { serviceId: query.serviceId, isActive: true },
        orderBy: [{ deliveryType: 'asc' }, { sortOrder: 'asc' }],
      }),
    ]);

    const serviceDefaults = allDurationOptions.filter((o) => o.employeeServiceId === null);
    const ownedByLink = new Map<string, typeof allDurationOptions>();
    for (const o of allDurationOptions) {
      if (o.employeeServiceId === null) continue;
      if (!ownedByLink.has(o.employeeServiceId)) ownedByLink.set(o.employeeServiceId, []);
      ownedByLink.get(o.employeeServiceId)!.push(o);
    }

    // Build map: employeeServiceId -> deliveryType -> option
    const optionsByLink = new Map<string, Map<string, (typeof allOptions)[0]>>();
    for (const opt of allOptions) {
      if (!optionsByLink.has(opt.employeeServiceId)) {
        optionsByLink.set(opt.employeeServiceId, new Map());
      }
      optionsByLink.get(opt.employeeServiceId)!.set(String(opt.deliveryType), opt);
    }

    const availableTypes = configs.map((c) => c.deliveryType);
    const empById = new Map(employees.map((e) => [e.id, e]));

    return links
      .filter((l) => empById.has(l.employeeId))
      .sort((a, b) =>
        (empById.get(a.employeeId)!.name ?? '').localeCompare(
          empById.get(b.employeeId)!.name ?? '',
          'ar',
        ),
      )
      .map((l) => {
        const e = empById.get(l.employeeId)!;
        const { firstName, lastName } = splitName(e.name, e.nameAr, e.nameEn);
        const empOptions = optionsByLink.get(l.id) ?? new Map<string, (typeof allOptions)[0]>();

        const serviceTypes = configs.map((c) => {
          const basePrice = Number(c.price);
          const baseDuration = c.durationMins;
          const ov = empOptions.get(String(c.deliveryType));
          const isCustom = !!ov && (ov.priceOverride !== null || ov.durationOverride !== null);
          const price =
            ov && ov.priceOverride !== null && ov.priceOverride !== undefined
              ? Number(ov.priceOverride)
              : basePrice;
          const durationMins =
            ov && ov.durationOverride !== null && ov.durationOverride !== undefined
              ? ov.durationOverride
              : baseDuration;
          return {
            id: `${l.id}:${c.deliveryType}`,
            deliveryType: c.deliveryType,
            /** @deprecated deliveryType is the source of truth. */
            bookingType: c.deliveryType,
            price,
            durationMins,
            basePrice,
            baseDurationMins: baseDuration,
            isCustom,
            isActive: true,
          };
        });

        const hasCustomPricing = serviceTypes.some((t) => t.isCustom);

        return {
          id: l.id,
          employee: {
            id: e.id,
            nameAr: e.nameAr,
            title: e.title,
            avatarUrl: e.avatarUrl,
            isActive: e.isActive,
            branchIds: (e.branches ?? []).map((b) => b.branchId),
            user: { firstName, lastName },
          },
          serviceTypes,
          hasCustomPricing,
          customDuration: null,
          bufferMinutes: l.bufferMinutes,
          availableTypes,
          isActive: l.isActive,
          effectiveDurations: resolveEffectiveDurations(serviceDefaults, ownedByLink.get(l.id) ?? []),
        };
      });
  }
}

function splitName(full: string | null, ar: string | null, en: string | null) {
  const source = ar ?? en ?? full ?? '';
  const parts = source.trim().split(/\s+/);
  if (parts.length <= 1) return { firstName: source, lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}
