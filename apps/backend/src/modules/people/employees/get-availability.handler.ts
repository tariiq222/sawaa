import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

export type GetAvailabilityCommand = { employeeId: string };

@Injectable()
export class GetAvailabilityHandler {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async execute(cmd: GetAvailabilityCommand) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: cmd.employeeId },
    });
    if (!employee) throw new NotFoundException('Employee not found');

    const schedule = await this.prisma.employeeAvailability.findMany({
      where: { employeeId: cmd.employeeId },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });

    const exceptions = await this.prisma.employeeAvailabilityException.findMany({
      where: { employeeId: cmd.employeeId },
      orderBy: { startDate: 'asc' },
    });

    return { schedule, exceptions };
  }
}
