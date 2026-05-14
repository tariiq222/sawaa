import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { EventBusService } from '../../../infrastructure/events';
import { EmployeeDeactivatedEvent } from '../events/employee-deactivated.event';
import { EmployeeReactivatedEvent } from '../events/employee-reactivated.event';
import { UpdateEmployeeDto } from './update-employee.dto';
import { DEFAULT_ORG_ID } from '../../../common/constants';

export type UpdateEmployeeCommand = UpdateEmployeeDto & {
  employeeId: string;
};

@Injectable()
export class UpdateEmployeeHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  async execute(cmd: UpdateEmployeeCommand) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: cmd.employeeId },
    });
    if (!employee) throw new NotFoundException('Employee not found');

    const wasActive = employee.isActive;
    const { employeeId: _e, avatarUrl, ...rest } = cmd;
    const data: Record<string, unknown> = { ...rest };
    if (avatarUrl !== undefined) data.avatarUrl = avatarUrl;
    if (cmd.nameAr || cmd.nameEn) {
      data.name = cmd.nameAr ?? cmd.nameEn ?? employee.name;
    }

    const updated = await this.prisma.employee.update({
      where: { id: cmd.employeeId },
      data,
      include: { branches: true, services: true },
    });

    if (cmd.isActive !== undefined && cmd.isActive !== wasActive) {
      const event = cmd.isActive
        ? new EmployeeReactivatedEvent({ employeeId: updated.id, organizationId: DEFAULT_ORG_ID })
        : new EmployeeDeactivatedEvent({ employeeId: updated.id, organizationId: DEFAULT_ORG_ID });
      await this.eventBus.publish(event.eventName, event.toEnvelope()).catch(() => undefined);
    }

    return updated;
  }
}
