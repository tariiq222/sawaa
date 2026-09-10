import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

export interface GetEmployeeClientHistoryCommand {
  employeeId: string;
  clientId: string;
}

@Injectable()
export class GetEmployeeClientHistoryHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(command: GetEmployeeClientHistoryCommand) {
    return this.prisma.booking.findMany({
      where: {
        employeeId: command.employeeId,
        clientId: command.clientId,
      },
      orderBy: { scheduledAt: 'desc' },
      take: 20,
    });
  }
}
