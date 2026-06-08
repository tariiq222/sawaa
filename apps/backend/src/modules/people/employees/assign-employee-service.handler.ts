import { BadRequestException, Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

export interface AssignEmployeeServiceCommand { employeeId: string; serviceId: string; }

@Injectable()
export class AssignEmployeeServiceHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: AssignEmployeeServiceCommand) {
    if (!cmd.serviceId) {
      throw new BadRequestException('serviceId is required');
    }

    const employee = await this.prisma.employee.findFirst({
      where: { id: cmd.employeeId },
    });
    if (!employee) throw new NotFoundException('Employee not found');

    const service = await this.prisma.service.findFirst({
      where: { id: cmd.serviceId, archivedAt: null },
    });
    if (!service) throw new NotFoundException('Service not found');

    const existing = await this.prisma.employeeService.findUnique({
      where: { employeeId_serviceId: { employeeId: cmd.employeeId, serviceId: cmd.serviceId } },
    });
    if (existing) throw new ConflictException('Service already assigned to employee');

    return this.prisma.employeeService.create({
      data: {
        employeeId: cmd.employeeId,
        serviceId: cmd.serviceId,
      },
    });
  }
}
