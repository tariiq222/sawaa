import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database';

export interface GetPractitionerBookingOptionsQuery {
  serviceId: string;
  employeeId: string;
}

export interface BookingOption {
  deliveryType: 'IN_PERSON' | 'ONLINE';
  durationOptionId: string;
  durationMins: number;
  price: number;
  currency: string;
  label: string | null;
}

export interface PractitionerBookingOptionsResult {
  useCustomPricing: boolean;
  disabledDeliveryTypes: ('IN_PERSON' | 'ONLINE')[];
  options: BookingOption[];
}

@Injectable()
export class GetPractitionerBookingOptionsHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: GetPractitionerBookingOptionsQuery): Promise<PractitionerBookingOptionsResult> {
    // Resolve link
    const link = await this.prisma.employeeService.findUnique({
      where: {
        employeeId_serviceId: { employeeId: query.employeeId, serviceId: query.serviceId },
      },
      select: {
        id: true,
        isActive: true,
        disabledDeliveryTypes: true,
        useCustomPricing: true,
        serviceId: true,
      },
    });
    if (!link) throw new NotFoundException('Employee-service assignment not found');

    const useCustomPricing = link.useCustomPricing ?? false;
    const disabledDeliveryTypes = (link.disabledDeliveryTypes ?? []) as ('IN_PERSON' | 'ONLINE')[];

    // Visibility gates: never expose pricing for a hidden/archived/inactive
    // service or an inactive practitioner (mirrors check-availability + create-booking).
    const service = await this.prisma.service.findUnique({
      where: { id: query.serviceId },
      select: {
        currency: true,
        isActive: true,
        archivedAt: true,
        isHidden: true,
        category: { select: { bookingMode: true } },
      },
    });
    if (
      !service ||
      service.isActive === false ||
      service.archivedAt != null ||
      (service.isHidden === true && service.category?.bookingMode !== 'DIRECT')
    ) {
      throw new NotFoundException('Service not found');
    }

    const employee = await this.prisma.employee.findFirst({
      where: { id: query.employeeId },
      select: { isActive: true },
    });
    if (!link.isActive || !employee || employee.isActive === false) {
      return { useCustomPricing, disabledDeliveryTypes, options: [] };
    }

    // Active booking configs = candidate delivery types
    const activeConfigs = await this.prisma.serviceBookingConfig.findMany({
      where: { serviceId: query.serviceId, isActive: true },
      select: { deliveryType: true, price: true, durationMins: true },
    });

    const currency = service.currency ?? 'SAR';

    const candidateTypes = activeConfigs
      .map((c) => c.deliveryType as 'IN_PERSON' | 'ONLINE')
      .filter((dt) => !disabledDeliveryTypes.includes(dt));

    const options: BookingOption[] = [];

    for (const dt of candidateTypes) {
      if (useCustomPricing) {
        // Custom mode: only owned rows
        const owned = await this.prisma.serviceDurationOption.findMany({
          where: {
            serviceId: query.serviceId,
            deliveryType: dt,
            employeeServiceId: link.id,
            isActive: true,
          },
          orderBy: { sortOrder: 'asc' },
          select: {
            id: true, durationMins: true, price: true, currency: true,
            labelAr: true, label: true,
          },
        });
        // If no owned rows for this type, skip it entirely
        if (owned.length === 0) continue;
        for (const row of owned) {
          options.push({
            deliveryType: dt,
            durationOptionId: row.id,
            durationMins: row.durationMins,
            price: Number(row.price),
            currency: row.currency,
            label: (row.labelAr ?? row.label) as string | null,
          });
        }
      } else {
        // Inherit mode: service defaults + employee overrides
        const svcOpts = await this.prisma.serviceDurationOption.findMany({
          where: {
            serviceId: query.serviceId,
            deliveryType: dt,
            employeeServiceId: null,
            isActive: true,
          },
          orderBy: { sortOrder: 'asc' },
          select: {
            id: true, durationMins: true, price: true, currency: true,
            labelAr: true, label: true,
          },
        });

        if (svcOpts.length > 0) {
          // Batch all employee overrides for this delivery type's rows in one
          // query, then map in memory (was an N+1 findFirst per row).
          const rowIds = svcOpts.map((r) => r.id);
          const overrides = await this.prisma.employeeServiceOption.findMany({
            where: {
              employeeServiceId: link.id,
              durationOptionId: { in: rowIds },
              isActive: true,
            },
            select: {
              durationOptionId: true,
              priceOverride: true,
              durationOverride: true,
            },
          });
          const overrideByOption = new Map(
            overrides.map((o) => [o.durationOptionId, o]),
          );

          for (const row of svcOpts) {
            const override = overrideByOption.get(row.id);
            options.push({
              deliveryType: dt,
              durationOptionId: row.id,
              durationMins:
                override?.durationOverride != null
                  ? Number(override.durationOverride)
                  : row.durationMins,
              price:
                override?.priceOverride != null
                  ? Number(override.priceOverride)
                  : Number(row.price),
              currency: row.currency,
              label: (row.labelAr ?? row.label) as string | null,
            });
          }
        } else {
          // Fallback to config-level price
          const cfg = activeConfigs.find((c) => c.deliveryType === dt);
          if (cfg) {
            options.push({
              deliveryType: dt,
              durationOptionId: '',
              durationMins: cfg.durationMins,
              price: Number(cfg.price),
              currency,
              label: null,
            });
          }
        }
      }
    }

    return { useCustomPricing, disabledDeliveryTypes, options };
  }
}
