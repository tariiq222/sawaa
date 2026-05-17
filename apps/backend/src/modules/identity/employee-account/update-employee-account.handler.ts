import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { UpdateEmployeeAccountDto } from './update-employee-account.dto';

export type UpdateEmployeeAccountCommand = UpdateEmployeeAccountDto & { employeeId: string };

@Injectable()
export class UpdateEmployeeAccountHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: UpdateEmployeeAccountCommand) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: cmd.employeeId },
    });
    if (!employee) throw new NotFoundException('Employee not found');

    if (!employee.userId) {
      throw new NotFoundException('Employee has no linked account');
    }

    return this.prisma.user.update({
      where: { id: employee.userId },
      data: { role: cmd.role, isActive: cmd.isActive },
      omit: { passwordHash: true },
    });
  }
}
