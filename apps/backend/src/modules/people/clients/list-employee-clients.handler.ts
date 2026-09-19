import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';

export const employeeClientSelect = {
  id: true,
  name: true,
  firstName: true,
  lastName: true,
  phone: true,
  email: true,
  gender: true,
  dateOfBirth: true,
  avatarUrl: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ClientSelect;

export interface ListEmployeeClientsCommand {
  employeeId: string;
  page: number;
  limit: number;
  search?: string;
}

@Injectable()
export class ListEmployeeClientsHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(command: ListEmployeeClientsCommand) {
    const clientIdRows = await this.prisma.booking.findMany({
      where: { employeeId: command.employeeId },
      select: { clientId: true },
      distinct: ['clientId'],
    });
    const clientIds = clientIdRows.map((booking) => booking.clientId);
    const where: Prisma.ClientWhereInput = {
      id: { in: clientIds },
      ...(command.search
        ? {
            OR: [
              { name: { contains: command.search, mode: 'insensitive' } },
              { phone: { contains: command.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.client.findMany({
        where,
        select: employeeClientSelect,
        skip: (command.page - 1) * command.limit,
        take: command.limit,
        orderBy: { name: 'asc' },
      }),
      this.prisma.client.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page: command.page,
        limit: command.limit,
        totalPages: Math.ceil(total / command.limit),
      },
    };
  }
}
