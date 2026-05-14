import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database';

export interface PublicEmployeeItem {
  id: string;
  slug: string | null;
  nameAr: string | null;
  nameEn: string | null;
  title: string | null;
  specialty: string | null;
  specialtyAr: string | null;
  publicBioAr: string | null;
  publicBioEn: string | null;
  publicImageUrl: string | null;
  gender: string | null;
  employmentType: string;
  ratingAverage: number | null;
  ratingCount: number;
  minServicePrice: number | null;
  isAvailableToday: boolean;
}

@Injectable()
export class ListPublicEmployeesHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(): Promise<PublicEmployeeItem[]> {
    const rows = await this.prisma.employee.findMany({
      where: { isPublic: true, isActive: true },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        slug: true,
        nameAr: true,
        nameEn: true,
        title: true,
        specialty: true,
        specialtyAr: true,
        publicBioAr: true,
        publicBioEn: true,
        publicImageUrl: true,
        gender: true,
        employmentType: true,
      },
    });

    if (rows.length === 0) return [];

    const ids = rows.map((r) => r.id);
    const todayDow = new Date().getDay();

    const [ratings, employeeServiceLinks, availabilities] = await Promise.all([
      this.prisma.rating.groupBy({
        by: ['employeeId'],
        where: { employeeId: { in: ids }, isPublic: true },
        _avg: { score: true },
        _count: { _all: true },
      }),
      this.prisma.employeeService.findMany({
        where: { employeeId: { in: ids } },
        select: { employeeId: true, serviceId: true },
      }),
      this.prisma.employeeAvailability.findMany({
        where: { employeeId: { in: ids }, isActive: true, dayOfWeek: todayDow },
        select: { employeeId: true },
      }),
    ]);

    // Fetch service prices for all linked serviceIds
    const serviceIds = [...new Set(employeeServiceLinks.map((l) => l.serviceId))];
    const services =
      serviceIds.length > 0
        ? await this.prisma.service.findMany({
            where: { id: { in: serviceIds }, isActive: true },
            select: { id: true, price: true },
          })
        : [];
    const priceByServiceId = new Map(services.map((s) => [s.id, parseFloat(String(s.price))]));

    // Group prices by employee
    const pricesByEmployee = new Map<string, number[]>();
    for (const link of employeeServiceLinks) {
      const price = priceByServiceId.get(link.serviceId);
      if (price === undefined) continue;
      if (!pricesByEmployee.has(link.employeeId)) pricesByEmployee.set(link.employeeId, []);
      pricesByEmployee.get(link.employeeId)!.push(price);
    }

    const byEmployee = new Map(
      ratings.map((r) => [r.employeeId, { avg: r._avg.score ?? null, count: r._count._all }]),
    );
    const availableToday = new Set(availabilities.map((a) => a.employeeId));

    return rows.map((r) => {
      const stat = byEmployee.get(r.id);
      const prices = pricesByEmployee.get(r.id) ?? [];
      return {
        ...r,
        gender: r.gender ?? null,
        ratingAverage: stat?.avg ?? null,
        ratingCount: stat?.count ?? 0,
        minServicePrice: prices.length > 0 ? Math.min(...prices) : null,
        isAvailableToday: availableToday.has(r.id),
      };
    });
  }
}
