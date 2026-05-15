import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

export interface UpdateEmployeeServiceCommand {
  employeeId: string;
  serviceId: string;
  isActive?: boolean;
}

@Injectable()
export class UpdateEmployeeServiceHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: UpdateEmployeeServiceCommand) {
    const record = await this.prisma.employeeService.findUnique({
      where: { employeeId_serviceId: { employeeId: cmd.employeeId, serviceId: cmd.serviceId } },
    });
    if (!record) throw new NotFoundException('Employee-service assignment not found');

    return record;
  }
}
