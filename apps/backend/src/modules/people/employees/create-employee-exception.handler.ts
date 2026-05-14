import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

export interface CreateEmployeeExceptionCommand {
  employeeId: string;
  startDate: string;
  endDate: string;
  endTime?: string;
  isStartTimeOnly?: boolean;
  reason?: string;
}

@Injectable()
export class CreateEmployeeExceptionHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: CreateEmployeeExceptionCommand) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: cmd.employeeId },
    });
    if (!employee) throw new NotFoundException('Employee not found');

    const start = new Date(cmd.startDate);
    const end = new Date(cmd.endDate);
    if (end < start) throw new BadRequestException('endDate must be after startDate');

    const endTime = cmd.endTime ? new Date(cmd.endTime) : null;
    if (endTime && endTime < start) {
      throw new BadRequestException('endTime must be at or after startDate');
    }

    return this.prisma.employeeAvailabilityException.create({
      data: {
        employeeId: cmd.employeeId,
        startDate: start,
        endDate: end,
        endTime,
        isStartTimeOnly: cmd.isStartTimeOnly ?? false,
        reason: cmd.reason,
      },
    });
  }
}
