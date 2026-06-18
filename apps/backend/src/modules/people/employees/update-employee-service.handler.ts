import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

export interface UpdateEmployeeServiceCommand {
  employeeId: string;
  serviceId: string;
  isActive?: boolean;
  bufferMinutes?: number;
}

@Injectable()
export class UpdateEmployeeServiceHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: UpdateEmployeeServiceCommand) {
    const record = await this.prisma.employeeService.findUnique({
      where: { employeeId_serviceId: { employeeId: cmd.employeeId, serviceId: cmd.serviceId } },
    });
    if (!record) throw new NotFoundException('Employee-service assignment not found');

    if (cmd.isActive === undefined && cmd.bufferMinutes === undefined) return record;

    // Track B — practitioner integrity: the link's effect on availability is
    // only seen when the employee is also active. Toggling a link while the
    // employee is inactive is a no-op from the user's perspective, but it
    // silently mutates state that becomes visible when the employee is
    // re-enabled. Reject the write to keep state consistent with the
    // assign-employee-service invariant.
    if (cmd.isActive === true) {
      const employee = await this.prisma.employee.findFirst({
        where: { id: cmd.employeeId },
        select: { isActive: true },
      });
      if (employee && employee.isActive === false) {
        throw new BadRequestException('Employee is not active');
      }
    }

    if (cmd.bufferMinutes !== undefined && (cmd.bufferMinutes < 0 || !Number.isInteger(cmd.bufferMinutes))) {
      throw new BadRequestException('bufferMinutes must be a non-negative integer');
    }

    return this.prisma.employeeService.update({
      where: { employeeId_serviceId: { employeeId: cmd.employeeId, serviceId: cmd.serviceId } },
      data: {
        ...(cmd.isActive !== undefined ? { isActive: cmd.isActive } : {}),
        ...(cmd.bufferMinutes !== undefined ? { bufferMinutes: cmd.bufferMinutes } : {}),
      },
    });
  }
}
