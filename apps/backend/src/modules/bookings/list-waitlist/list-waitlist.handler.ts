import { Injectable } from '@nestjs/common';
import { WaitlistStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { ListWaitlistDto } from './list-waitlist.dto';

export type ListWaitlistQuery = ListWaitlistDto;

@Injectable()
export class ListWaitlistHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: ListWaitlistQuery) {
    const entries = await this.prisma.waitlistEntry.findMany({
      where: {
        ...(query.employeeId ? { employeeId: query.employeeId } : {}),
        ...(query.status ? { status: query.status as WaitlistStatus } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });

    if (entries.length === 0) return [];

    // Cross-BC IDs (clientId/employeeId/serviceId) carry no Prisma FK relation
    // by design, so enrich via batched lookups instead of `include`.
    const [clients, employees, services] = await Promise.all([
      this.prisma.client.findMany({
        where: { id: { in: [...new Set(entries.map((e) => e.clientId))] } },
        select: { id: true, name: true, phone: true },
      }),
      this.prisma.employee.findMany({
        where: { id: { in: [...new Set(entries.map((e) => e.employeeId))] } },
        select: { id: true, name: true },
      }),
      this.prisma.service.findMany({
        where: { id: { in: [...new Set(entries.map((e) => e.serviceId))] } },
        select: { id: true, nameAr: true, nameEn: true },
      }),
    ]);

    const clientById = new Map(clients.map((c) => [c.id, c]));
    const employeeById = new Map(employees.map((e) => [e.id, e]));
    const serviceById = new Map(services.map((s) => [s.id, s]));

    return entries.map((entry) => ({
      ...entry,
      client: clientById.get(entry.clientId) ?? null,
      employee: employeeById.get(entry.employeeId) ?? null,
      service: serviceById.get(entry.serviceId) ?? null,
    }));
  }
}
