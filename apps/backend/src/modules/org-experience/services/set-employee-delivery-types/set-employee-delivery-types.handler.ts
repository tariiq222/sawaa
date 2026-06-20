import { Injectable, NotFoundException } from '@nestjs/common';
import { DeliveryType } from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/database';
import { normalizeDeliveryTypeInput } from '../delivery-type-input.helper';
import { SetEmployeeDeliveryTypesCommand } from './set-employee-delivery-types.dto';

export { SetEmployeeDeliveryTypesCommand };

/**
 * Sets which delivery types a practitioner opts out of for a given service.
 * The service stays the source of truth for which types exist; this only lets
 * an individual practitioner be e.g. remote-only while the service offers both.
 */
@Injectable()
export class SetEmployeeDeliveryTypesHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: SetEmployeeDeliveryTypesCommand) {
    const link = await this.prisma.employeeService.findUnique({
      where: { employeeId_serviceId: { employeeId: cmd.employeeId, serviceId: cmd.serviceId } },
    });
    if (!link) throw new NotFoundException('Employee-service assignment not found');

    const disabled = Array.from(
      new Set(cmd.disabledDeliveryTypes.map((d) => normalizeDeliveryTypeInput(d))),
    ) as DeliveryType[];

    const updated = await this.prisma.employeeService.update({
      where: { id: link.id },
      data: { disabledDeliveryTypes: disabled },
      select: { disabledDeliveryTypes: true },
    });

    return { disabledDeliveryTypes: updated.disabledDeliveryTypes };
  }
}
