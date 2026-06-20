import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database';
import { SetEmployeePricingModeCommand } from './set-employee-pricing-mode.dto';

export { SetEmployeePricingModeCommand };

/**
 * Sets whether a practitioner uses custom pricing (owned duration options only)
 * or inherits the service-level options for a given service.
 */
@Injectable()
export class SetEmployeePricingModeHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: SetEmployeePricingModeCommand) {
    const link = await this.prisma.employeeService.findUnique({
      where: { employeeId_serviceId: { employeeId: cmd.employeeId, serviceId: cmd.serviceId } },
    });
    if (!link) throw new NotFoundException('Employee-service assignment not found');

    // Guard against locking the practitioner out of all booking surfaces:
    // enabling custom pricing with no owned duration rows would make every
    // delivery type vanish (booking-options + availability both return empty).
    if (cmd.useCustomPricing === true) {
      const ownedCount = await this.prisma.serviceDurationOption.count({
        where: { serviceId: cmd.serviceId, employeeServiceId: link.id, isActive: true },
      });
      if (ownedCount === 0) {
        throw new BadRequestException(
          'Add at least one custom duration for this practitioner before enabling custom pricing',
        );
      }
    }

    const updated = await this.prisma.employeeService.update({
      where: { id: link.id },
      data: { useCustomPricing: cmd.useCustomPricing },
      select: { useCustomPricing: true },
    });

    return { useCustomPricing: updated.useCustomPricing };
  }
}
