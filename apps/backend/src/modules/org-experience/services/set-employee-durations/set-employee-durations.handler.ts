import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService, RlsTransactionService } from '../../../../infrastructure/database';
import { normalizeDeliveryTypeInput } from '../delivery-type-input.helper';
import { SetEmployeeDurationsCommand } from './set-employee-durations.dto';

export { SetEmployeeDurationsCommand };

/**
 * Manages a practitioner's owned ServiceDurationOption rows (employeeServiceId = EmployeeService.id).
 *
 * Resolution rule per (service, employee, deliveryType):
 *  - If practitioner has own active rows for that deliveryType → those replace service defaults
 *  - If no own rows → practitioner inherits service defaults (employeeServiceId IS NULL)
 */
@Injectable()
export class SetEmployeeDurationsHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rlsTransaction: RlsTransactionService,
  ) {}

  async execute(cmd: SetEmployeeDurationsCommand) {
    // 1. Verify EmployeeService link exists
    const link = await this.prisma.employeeService.findUnique({
      where: { employeeId_serviceId: { employeeId: cmd.employeeId, serviceId: cmd.serviceId } },
    });
    if (!link) throw new NotFoundException('Employee-service assignment not found');
    const employeeServiceId = link.id;

    await this.rlsTransaction.withTransaction(async (tx: any) => {
      for (const group of cmd.durations) {
        const deliveryType = normalizeDeliveryTypeInput(group.deliveryType);

        // Validate: delivery type must have an active ServiceBookingConfig for this service
        const config = await tx.serviceBookingConfig.findFirst({
          where: { serviceId: cmd.serviceId, deliveryType, isActive: true },
        });
        if (!config) {
          throw new BadRequestException(
            `Service does not have an active booking config for delivery type ${deliveryType}`,
          );
        }

        if (!group.items || group.items.length === 0) {
          // Revert to inheriting: soft-deactivate all owned rows for this deliveryType
          await tx.serviceDurationOption.updateMany({
            where: { serviceId: cmd.serviceId, deliveryType, employeeServiceId, isActive: true },
            data: { isActive: false },
          });
          continue;
        }

        // Collect IDs that are staying (either updated or newly created)
        const keepIds: string[] = [];

        for (const item of group.items) {
          if (item.id) {
            // Update existing row — must belong to this employee+service+deliveryType
            const existing = await tx.serviceDurationOption.findFirst({
              where: {
                id: item.id,
                serviceId: cmd.serviceId,
                deliveryType,
                employeeServiceId,
              },
            });
            if (!existing) {
              throw new BadRequestException(
                `Duration option ${item.id} not found or does not belong to this practitioner`,
              );
            }
            await tx.serviceDurationOption.update({
              where: { id: item.id },
              data: {
                label: item.label,
                labelAr: item.labelAr,
                durationMins: item.durationMins,
                price: item.price,
                isActive: true,
              },
            });
            keepIds.push(item.id);
          } else {
            // Create new row
            const created = await tx.serviceDurationOption.create({
              data: {
                serviceId: cmd.serviceId,
                deliveryType,
                employeeServiceId,
                label: item.label,
                labelAr: item.labelAr,
                durationMins: item.durationMins,
                price: item.price,
                currency: 'SAR',
                isDefault: false,
                sortOrder: 0,
                isActive: true,
              },
            });
            keepIds.push(created.id);
          }
        }

        // Soft-deactivate any owned rows for this deliveryType NOT in keepIds
        await tx.serviceDurationOption.updateMany({
          where: {
            serviceId: cmd.serviceId,
            deliveryType,
            employeeServiceId,
            isActive: true,
            id: { notIn: keepIds },
          },
          data: { isActive: false },
        });
      }
    });

    return this.buildResult(employeeServiceId, cmd.serviceId);
  }

  async buildResult(employeeServiceId: string, serviceId: string) {
    // Get service-level default options (employeeServiceId IS NULL)
    const serviceDefaults = await this.prisma.serviceDurationOption.findMany({
      where: { serviceId, isActive: true, employeeServiceId: null },
      orderBy: [{ deliveryType: 'asc' }, { sortOrder: 'asc' }],
    });

    // Get practitioner-owned options
    const ownedRows = await this.prisma.serviceDurationOption.findMany({
      where: { serviceId, employeeServiceId, isActive: true },
      orderBy: [{ deliveryType: 'asc' }, { sortOrder: 'asc' }],
    });

    return resolveEffectiveDurations(serviceDefaults, ownedRows);
  }
}

/**
 * Shared resolution logic: given service defaults and practitioner-owned rows,
 * compute effective durations grouped by deliveryType.
 */
export function resolveEffectiveDurations(
  serviceDefaults: Array<{ id: string; deliveryType: string | { toString(): string }; label: string; labelAr: string; durationMins: number; price: unknown }>,
  ownedRows: Array<{ id: string; deliveryType: string | { toString(): string }; label: string; labelAr: string; durationMins: number; price: unknown }>,
) {
  // Group owned rows by deliveryType
  const ownedByType = new Map<string, typeof ownedRows>();
  for (const row of ownedRows) {
    const key = String(row.deliveryType);
    if (!ownedByType.has(key)) ownedByType.set(key, []);
    ownedByType.get(key)!.push(row);
  }

  // Get all deliveryTypes covered
  const allTypes = new Set<string>([
    ...serviceDefaults.map((r) => String(r.deliveryType)),
    ...ownedRows.map((r) => String(r.deliveryType)),
  ]);

  const result: Array<{
    deliveryType: string;
    durations: Array<{
      id: string;
      deliveryType: string;
      label: string;
      labelAr: string;
      durationMins: number;
      price: number;
      isInherited: boolean;
    }>;
  }> = [];

  for (const dt of allTypes) {
    const owned = ownedByType.get(dt);
    const isInherited = !owned || owned.length === 0;
    const rows = isInherited
      ? serviceDefaults.filter((r) => String(r.deliveryType) === dt)
      : owned!;

    result.push({
      deliveryType: dt,
      durations: rows.map((r) => ({
        id: r.id,
        deliveryType: String(r.deliveryType),
        label: r.label,
        labelAr: r.labelAr,
        durationMins: r.durationMins,
        price: Number(r.price),
        isInherited,
      })),
    });
  }

  return result;
}
