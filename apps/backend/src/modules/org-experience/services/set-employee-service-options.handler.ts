import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { SetEmployeeServiceOptionsDto } from './set-employee-service-options.dto';
import { normalizeDeliveryTypeInput } from './delivery-type-input.helper';

export type SetEmployeeServiceOptionsCommand = SetEmployeeServiceOptionsDto & {
  employeeServiceId: string;
};

@Injectable()
export class SetEmployeeServiceOptionsHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rlsTransaction: RlsTransactionService,
  ) {}

  async execute(dto: SetEmployeeServiceOptionsCommand) {
    const optionIds = dto.options.map((o) => o.durationOptionId);
    const validOptions = await this.prisma.serviceDurationOption.findMany({
      where: { id: { in: optionIds } },
      select: { id: true, deliveryType: true },
    });
    const validOptionById = new Map(validOptions.map((o) => [o.id, o]));
    const validIds = new Set(validOptionById.keys());
    const invalid = optionIds.filter((id) => !validIds.has(id));
    if (invalid.length > 0) {
      throw new NotFoundException(`ServiceDurationOption(s) not found: ${invalid.join(', ')}`);
    }

    await this.rlsTransaction.withTransaction((tx) =>
      Promise.all(dto.options.map((opt) =>
        {
          const linkedOption = validOptionById.get(opt.durationOptionId);
          const deliveryType = normalizeDeliveryTypeInput(opt.deliveryType ?? linkedOption?.deliveryType);
          return tx.employeeServiceOption.upsert({
          where: {
            employeeServiceId_durationOptionId_deliveryType: {
              employeeServiceId: dto.employeeServiceId,
              durationOptionId: opt.durationOptionId,
              deliveryType,
            },
          },
          create: {
            employeeServiceId: dto.employeeServiceId,
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
      where: { employeeServiceId: dto.employeeServiceId },
      include: { durationOption: true },
    });
  }
}
