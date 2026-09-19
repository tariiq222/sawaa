import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { employeeClientSelect } from './list-employee-clients.handler';

export interface GetEmployeeClientCommand {
  employeeId: string;
  clientId: string;
}

@Injectable()
export class GetEmployeeClientHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(command: GetEmployeeClientCommand) {
    const relationship = await this.prisma.booking.findFirst({
      where: { employeeId: command.employeeId, clientId: command.clientId },
      select: { id: true },
    });
    if (!relationship) throw new NotFoundException('Client not found');

    const client = await this.prisma.client.findFirst({
      where: { id: command.clientId },
      select: employeeClientSelect,
    });
    if (!client) throw new NotFoundException('Client not found');
    return client;
  }
}
