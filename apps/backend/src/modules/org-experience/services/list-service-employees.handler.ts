import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

export interface ListServiceEmployeesQuery {
  serviceId: string;
}

/**
 * Returns the active employees who offer the given service, shaped to match the
 * dashboard's `ServiceEmployee` contract (EmployeeService row + nested employee + serviceTypes).
 */
@Injectable()
export class ListServiceEmployeesHandler {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async execute(query: ListServiceEmployeesQuery) {
    const service = await this.prisma.service.findFirst({ where: { id: query.serviceId } });
    if (!service) throw new NotFoundException('Service not found');

    const links = await this.prisma.employeeService.findMany({
      where: { serviceId: query.serviceId },
    });
    if (links.length === 0) return [];

    const [employees, configs] = await Promise.all([
      this.prisma.employee.findMany({
        where: { id: { in: links.map((l) => l.employeeId) }, isActive: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.serviceBookingConfig.findMany({
        where: { serviceId: query.serviceId, isActive: true },
        orderBy: { bookingType: 'asc' },
      }),
    ]);

    const serviceTypes = configs.map((c) => ({
      id: `${query.serviceId}:${c.bookingType}`,
      bookingType: c.bookingType.toLowerCase(),
      price: Number(c.price),
      durationMins: c.durationMins,
      isActive: c.isActive,
    }));
    const availableTypes = serviceTypes.map((s) => s.bookingType);

    const empById = new Map(employees.map((e) => [e.id, e]));
    return links
      .filter((l) => empById.has(l.employeeId))
      .map((l) => {
        const e = empById.get(l.employeeId)!;
        const { firstName, lastName } = splitName(e.name, e.nameAr, e.nameEn);
        return {
          id: l.id,
          employee: {
            id: e.id,
            nameAr: e.nameAr,
            title: e.title,
            avatarUrl: e.avatarUrl,
            isActive: e.isActive,
            user: { firstName, lastName },
          },
          serviceTypes,
          customDuration: null,
          bufferMinutes: 0,
          availableTypes,
          isActive: true,
        };
      });
  }
}

function splitName(full: string | null, ar: string | null, en: string | null) {
  const source = ar ?? en ?? full ?? '';
  const parts = source.trim().split(/\s+/);
  if (parts.length <= 1) return { firstName: source, lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}
