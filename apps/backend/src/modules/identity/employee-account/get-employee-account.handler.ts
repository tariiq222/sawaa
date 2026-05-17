import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

export interface GetEmployeeAccountCommand {
  employeeId: string;
}

@Injectable()
export class GetEmployeeAccountHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: GetEmployeeAccountCommand) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: cmd.employeeId },
    });
    if (!employee) throw new NotFoundException('Employee not found');

    if (employee.userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: employee.userId },
        select: { id: true, email: true, role: true, isActive: true },
      });
      return {
        hasAccount: true,
        employeeEmail: employee.email,
        account: user,
      };
    }

    return {
      hasAccount: false,
      employeeEmail: employee.email,
      account: null,
    };
  }
}
