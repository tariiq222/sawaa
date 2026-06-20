import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { CreateGroupSessionDto } from './create-group-session.dto';

export type CreateGroupSessionCommand = Omit<CreateGroupSessionDto, 'scheduledAt'> & {
  scheduledAt: Date;
};

@Injectable()
export class CreateGroupSessionHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: CreateGroupSessionCommand) {
    if (cmd.scheduledAt <= new Date()) {
      throw new BadRequestException('scheduledAt must be in the future');
    }

    // 1. Branch check
    const branch = await this.prisma.branch.findFirst({
      where: { id: cmd.branchId },
      select: { id: true, nameAr: true, isActive: true },
    });
    if (!branch) throw new NotFoundException('Branch not found');
    if (branch.isActive === false) throw new BadRequestException('Branch is not active');

    // 2. Employee check
    const employee = await this.prisma.employee.findFirst({
      where: { id: cmd.employeeId },
      select: { id: true, name: true, isActive: true },
    });
    if (!employee) throw new NotFoundException('Employee not found');
    if (employee.isActive === false) throw new BadRequestException('Employee is not active');

    // 3. Service check
    const service = await this.prisma.service.findFirst({
      where: { id: cmd.serviceId },
      select: { id: true, nameAr: true, isActive: true, archivedAt: true },
    });
    if (!service) throw new NotFoundException('Service not found');
    if (service.isActive === false) throw new BadRequestException('Service is not active');
    if (service.archivedAt != null) throw new BadRequestException('Service is archived');

    // 4. EmployeeService link check
    const employeeService = await this.prisma.employeeService.findUnique({
      where: { employeeId_serviceId: { employeeId: cmd.employeeId, serviceId: cmd.serviceId } },
    });
    if (!employeeService || employeeService.isActive === false) {
      throw new BadRequestException('Employee does not provide this service');
    }

    const session = await this.prisma.groupSession.create({
      data: {
        branchId: cmd.branchId,
        employeeId: cmd.employeeId,
        serviceId: cmd.serviceId,
        title: cmd.title,
        descriptionAr: cmd.descriptionAr,
        descriptionEn: cmd.descriptionEn,
        scheduledAt: cmd.scheduledAt,
        durationMins: cmd.durationMins,
        maxCapacity: cmd.maxCapacity,
        enrolledCount: 0,
        price: cmd.price,
        deliveryType: cmd.deliveryType,
        isPublic: cmd.isPublic ?? false,
        publicDescriptionAr: cmd.publicDescriptionAr,
        publicDescriptionEn: cmd.publicDescriptionEn,
      },
    });
    return { id: session.id, status: session.status, scheduledAt: session.scheduledAt };
  }
}
