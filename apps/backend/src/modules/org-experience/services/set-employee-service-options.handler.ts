import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { SetEmployeeServiceOptionsDto } from './set-employee-service-options.dto';
import { normalizeDeliveryTypeInput } from './delivery-type-input.helper';

export type SetEmployeeServiceOptionsCommand = SetEmployeeServiceOptionsDto & {
  employeeId: string;
  serviceId: string;
};

@Injectable()
export class SetEmployeeServiceOptionsHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rlsTransaction: RlsTransactionService,
  ) {}

  async execute(dto: SetEmployeeServiceOptionsCommand) {
    const link = await this.prisma.employeeService.findUnique({
      where: { employeeId_serviceId: { employeeId: dto.employeeId, serviceId: dto.serviceId } },
    });
    if (!link) throw new NotFoundException('Employee-service assignment not found');
    const employeeServiceId = link.id;

    // EmployeeServiceOption overrides are an INHERIT-mode mechanism only — in custom
    // mode the practitioner is priced from owned ServiceDurationOption rows and these
    // writes would be silently ignored. Fail loudly instead of losing data.
    if (link.useCustomPricing === true) {
      throw new BadRequestException(
        'Practitioner is in custom-pricing mode; set prices via the owned duration-options endpoint, not per-option overrides',
      );
    }

    const optionIds = dto.options.map((o) => o.durationOptionId);
    // Overrides may only target SERVICE-DEFAULT options (employeeServiceId IS NULL).
    // Targeting an owned row would create an ambiguous override that competes with
    // the owned-rows pricing path.
    const validOptions = await this.prisma.serviceDurationOption.findMany({
      where: { id: { in: optionIds }, employeeServiceId: null },
      select: { id: true, deliveryType: true },
    });
    const validOptionById = new Map(validOptions.map((o) => [o.id, o]));
    const validIds = new Set(validOptionById.keys());
    const invalid = optionIds.filter((id) => !validIds.has(id));
    if (invalid.length > 0) {
      throw new NotFoundException(`Service-default ServiceDurationOption(s) not found: ${invalid.join(', ')}`);
    }

    await this.rlsTransaction.withTransaction((tx) =>
      Promise.all(dto.options.map((opt) =>
        {
          const linkedOption = validOptionById.get(opt.durationOptionId);
          const deliveryType = normalizeDeliveryTypeInput(opt.deliveryType ?? linkedOption?.deliveryType);
          return tx.employeeServiceOption.upsert({
          where: {
            employeeServiceId_durationOptionId_deliveryType: {
              employeeServiceId,
              durationOptionId: opt.durationOptionId,
              deliveryType,
            },
          },
          create: {
            employeeServiceId,
            durationOptionId: opt.durationOptionId,
            deliveryType,
            priceOverride: opt.priceOverride ?? null,
            durationOverride: opt.durationOverride ?? null,
            isActive: opt.isActive ?? true,
          },
          update: {
            priceOverride: opt.priceOverride ?? null,
            durationOverride: opt.durationOverride ?? null,
            ...(opt.isActive !== undefined && { isActive: opt.isActive }),
          },
          });
        }
      )),
    );

    return this.prisma.employeeServiceOption.findMany({
      where: { employeeServiceId },
      include: { durationOption: true },
    });
  }
}
