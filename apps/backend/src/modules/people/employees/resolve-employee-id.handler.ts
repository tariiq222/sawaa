import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

export interface ResolveEmployeeIdCommand {
  userId: string;
  employeeId?: string;
}

@Injectable()
export class ResolveEmployeeIdHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(command: ResolveEmployeeIdCommand): Promise<string> {
    if (command.employeeId) {
      return command.employeeId;
    }

    const employee = await this.prisma.employee.findFirst({
      where: { userId: command.userId, isActive: true },
      select: { id: true },
    });

    if (!employee) {
      throw new ForbiddenException('employee_profile_not_found');
    }

    return employee.id;
  }
}
