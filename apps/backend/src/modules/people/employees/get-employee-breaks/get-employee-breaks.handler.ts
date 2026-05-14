import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';

export type GetEmployeeBreaksCommand = { employeeId: string };

@Injectable()
export class GetEmployeeBreaksHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: GetEmployeeBreaksCommand) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: cmd.employeeId },
    });
    if (!employee) throw new NotFoundException('Employee not found');

    const breaks = await this.prisma.employeeBreak.findMany({
      where: { employeeId: cmd.employeeId },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });

    return { breaks };
  }
}
